
-- 1) Tighten notifications UPDATE: lock down to is_read flips on own row
DROP POLICY IF EXISTS "recipient updates own" ON public.notifications;

CREATE POLICY "recipient updates own read flag"
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Trigger to prevent recipients from changing any field other than is_read.
-- Admins (who use the admins-insert path) bypass via is_admin check.
CREATE OR REPLACE FUNCTION public.notifications_lock_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.type        IS DISTINCT FROM OLD.type
     OR NEW.title       IS DISTINCT FROM OLD.title
     OR NEW.body        IS DISTINCT FROM OLD.body
     OR NEW.task_id     IS DISTINCT FROM OLD.task_id
     OR NEW.is_urgent   IS DISTINCT FROM OLD.is_urgent
     OR NEW.created_at  IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only the is_read flag may be modified on your notifications';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notifications_lock_fields_trg ON public.notifications;
CREATE TRIGGER notifications_lock_fields_trg
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_lock_fields();

-- 2) is_blocked enforcement via helper + RLS guard on user-facing tables
CREATE OR REPLACE FUNCTION public.is_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_blocked FROM public.profiles WHERE id = _user_id), false)
$$;

REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;

-- TASKS
DROP POLICY IF EXISTS "view own/assigned/admin tasks" ON public.tasks;
CREATE POLICY "view own/assigned/admin tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  NOT public.is_blocked(auth.uid()) AND (
    public.is_admin(auth.uid())
    OR creator_id = auth.uid()
    OR assignee_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id))
  )
);

DROP POLICY IF EXISTS "users insert own tasks" ON public.tasks;
CREATE POLICY "users insert own tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (creator_id = auth.uid() AND NOT public.is_blocked(auth.uid()));

DROP POLICY IF EXISTS "update own/assigned tasks" ON public.tasks;
CREATE POLICY "update own/assigned tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  NOT public.is_blocked(auth.uid()) AND (
    public.is_admin(auth.uid()) OR creator_id = auth.uid() OR assignee_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin(auth.uid()) OR creator_id = auth.uid() OR assignee_id = auth.uid()
);

DROP POLICY IF EXISTS "delete own tasks or admin" ON public.tasks;
CREATE POLICY "delete own tasks or admin"
ON public.tasks FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (creator_id = auth.uid() AND NOT public.is_blocked(auth.uid()))
);

-- CHAT
DROP POLICY IF EXISTS "team members read chat" ON public.chat_messages;
CREATE POLICY "team members read chat"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  NOT public.is_blocked(auth.uid()) AND (
    public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), team_id)
  )
);

DROP POLICY IF EXISTS "team members post chat" ON public.chat_messages;
CREATE POLICY "team members post chat"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND NOT public.is_blocked(auth.uid())
  AND (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), team_id))
);

-- NOTIFICATIONS read guard for blocked users
DROP POLICY IF EXISTS "recipient reads own" ON public.notifications;
CREATE POLICY "recipient reads own"
ON public.notifications FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (recipient_id = auth.uid() AND NOT public.is_blocked(auth.uid()))
);

-- TEAMS / TEAM_MEMBERS read guard
DROP POLICY IF EXISTS "members read teams" ON public.teams;
CREATE POLICY "members read teams"
ON public.teams FOR SELECT TO authenticated
USING (
  NOT public.is_blocked(auth.uid()) AND (
    public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), id) OR owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "members read team_members" ON public.team_members;
CREATE POLICY "members read team_members"
ON public.team_members FOR SELECT TO authenticated
USING (
  NOT public.is_blocked(auth.uid()) AND (
    public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), team_id) OR user_id = auth.uid()
  )
);
