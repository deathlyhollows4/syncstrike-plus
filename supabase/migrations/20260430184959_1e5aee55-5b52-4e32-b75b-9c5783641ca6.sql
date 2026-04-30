-- 1) Profiles INSERT policy
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 2) Length constraints (idempotent)
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_len;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_body_len CHECK (char_length(body) BETWEEN 1 AND 2000);

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_title_len;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_description_len;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_completion_description_len;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_blocker_reason_len;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_title_len CHECK (char_length(title) BETWEEN 1 AND 255),
  ADD CONSTRAINT tasks_description_len CHECK (description IS NULL OR char_length(description) <= 5000),
  ADD CONSTRAINT tasks_completion_description_len CHECK (completion_description IS NULL OR char_length(completion_description) <= 2000),
  ADD CONSTRAINT tasks_blocker_reason_len CHECK (blocker_reason IS NULL OR char_length(blocker_reason) <= 1000);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_len CHECK (display_name IS NULL OR char_length(display_name) <= 100),
  ADD CONSTRAINT profiles_avatar_url_len CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500),
  ADD CONSTRAINT profiles_email_len CHECK (char_length(email) <= 320);

-- 3) Trigger: prevent privilege escalation
CREATE OR REPLACE FUNCTION public.profiles_lock_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
    RAISE EXCEPTION 'Only admins can change block status';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Email cannot be changed here';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_lock_sensitive_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_lock_sensitive_fields_trg ON public.profiles;
CREATE TRIGGER profiles_lock_sensitive_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_lock_sensitive_fields();