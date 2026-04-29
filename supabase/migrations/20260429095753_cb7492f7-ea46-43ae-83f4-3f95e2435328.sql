-- Lock down SECURITY DEFINER helper functions (revoke from public/authenticated; we use them inside RLS via security-definer context)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_blocker() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tasks_validate() FROM PUBLIC, anon, authenticated;
-- has_role / is_admin / is_team_member must remain executable for RLS evaluation
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;

-- Tighten notification insert policy (no more USING true)
DROP POLICY IF EXISTS "system or admin inserts" ON public.notifications;
CREATE POLICY "users insert notif for self or admin for any" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (recipient_id = auth.uid() OR public.is_admin(auth.uid()));

-- Add search_path to remaining function (tasks_validate)
CREATE OR REPLACE FUNCTION public.tasks_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (NEW.completion_description IS NULL OR length(NEW.completion_description) < 5) THEN
    RAISE EXCEPTION 'Completion description must be at least 5 characters';
  END IF;
  IF NEW.status = 'blocked' AND (NEW.blocker_reason IS NULL OR length(NEW.blocker_reason) < 3) THEN
    RAISE EXCEPTION 'Blocker reason is required';
  END IF;
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;