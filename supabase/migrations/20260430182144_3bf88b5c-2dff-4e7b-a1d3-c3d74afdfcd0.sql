-- 1. Block 'is_blocked' users from updating their profile
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT public.is_blocked(auth.uid()))
  WITH CHECK (auth.uid() = id AND NOT public.is_blocked(auth.uid()));

-- 2. Block 'is_blocked' users from deleting notifications
DROP POLICY IF EXISTS "recipient or admin deletes" ON public.notifications;
CREATE POLICY "recipient or admin deletes" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (recipient_id = auth.uid() AND NOT public.is_blocked(auth.uid()))
  );

-- 3. Revoke EXECUTE on SECURITY DEFINER helpers from API roles.
-- These are only used inside RLS / triggers (which run as the function owner),
-- so revoking PUBLIC/anon/authenticated access does not break anything.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger-only helpers — never need to be callable from the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tasks_validate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tasks_lock_creator() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notifications_lock_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_blocker() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_task_blocked() FROM PUBLIC, anon, authenticated;