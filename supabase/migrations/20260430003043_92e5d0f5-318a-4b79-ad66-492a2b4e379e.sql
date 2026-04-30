
-- ========== PROFILES: restrict SELECT ==========
DROP POLICY IF EXISTS "auth users read profiles" ON public.profiles;

CREATE POLICY "users read relevant profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_members tm_self
      JOIN public.team_members tm_other ON tm_self.team_id = tm_other.team_id
      WHERE tm_self.user_id = auth.uid() AND tm_other.user_id = profiles.id
    )
  );

-- ========== TASKS: lock creator_id ==========
DROP POLICY IF EXISTS "update own/assigned tasks" ON public.tasks;

CREATE POLICY "update own/assigned tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR creator_id = auth.uid() OR assignee_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR creator_id = auth.uid() OR assignee_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.tasks_lock_creator()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change task ownership';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_lock_creator_trg ON public.tasks;
CREATE TRIGGER tasks_lock_creator_trg BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_lock_creator();

-- ========== NOTIFICATIONS: admins only insert (trigger uses SECURITY DEFINER, bypasses RLS) ==========
DROP POLICY IF EXISTS "users insert notif for self or admin for any" ON public.notifications;
DROP POLICY IF EXISTS "system or admin inserts" ON public.notifications;

CREATE POLICY "admins insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== ADMIN SEED: remove hardcoded email ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'team_member'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

-- ========== SECURITY DEFINER helpers: lock down EXECUTE ==========
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;

-- ========== REALTIME: enable RLS on realtime.messages and scope by topic ==========
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syncstrike realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "syncstrike realtime write" ON realtime.messages;

CREATE POLICY "syncstrike realtime read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    -- per-user notification channel
    OR realtime.topic() = 'notifications:' || auth.uid()::text
    -- global tasks channel: rely on table RLS to filter row payloads
    OR realtime.topic() LIKE 'tasks%'
    OR realtime.topic() LIKE 'tasks-%'
    -- team chat channels: chat:<team_id>
    OR (
      realtime.topic() LIKE 'chat:%'
      AND public.is_team_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    )
  );

CREATE POLICY "syncstrike realtime write" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR realtime.topic() = 'notifications:' || auth.uid()::text
    OR realtime.topic() LIKE 'tasks%'
    OR realtime.topic() LIKE 'tasks-%'
    OR (
      realtime.topic() LIKE 'chat:%'
      AND public.is_team_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    )
  );
