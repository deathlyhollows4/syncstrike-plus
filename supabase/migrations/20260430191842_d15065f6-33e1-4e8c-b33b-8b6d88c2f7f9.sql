-- Restore EXECUTE permission for RLS helper functions.
-- They were revoked in a previous hardening migration but are required by RLS
-- policies on profiles, teams, team_members, tasks, chat_messages, notifications.
-- Each function is SECURITY DEFINER and only checks role/membership, no PII exposure.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;

-- Remove duplicate length constraints (older + newer _chk versions both exist).
-- Keep the *_chk variants which match the latest hardening.
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_len;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_title_len;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_description_len;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_completion_description_len;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_blocker_reason_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_len;

-- Remove duplicate "blocked task" notification trigger; keep the WHEN-guarded one.
DROP TRIGGER IF EXISTS on_task_blocked ON public.tasks;

-- Add teams + team_members to realtime publication so Teams page updates live.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='teams'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.teams';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='team_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members';
  END IF;
END $$;