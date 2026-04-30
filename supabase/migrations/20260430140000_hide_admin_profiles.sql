-- Migration: Hide admin profiles from non-admins
-- Non-admins cannot view profiles of admin users
-- Timestamp: 2026-04-30

BEGIN;

-- Update the profiles read policy to exclude admin profiles for non-admins
DROP POLICY IF EXISTS "users read relevant profiles" ON public.profiles;

CREATE POLICY "users read relevant profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = profiles.id AND user_roles.role = 'admin'
      ) AND (
        EXISTS (
          SELECT 1 FROM public.team_members tm_self
          JOIN public.team_members tm_other ON tm_self.team_id = tm_other.team_id
          WHERE tm_self.user_id = auth.uid() AND tm_other.user_id = profiles.id
        )
      )
    )
  );

COMMIT;