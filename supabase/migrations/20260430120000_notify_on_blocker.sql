-- Migration: Notify admins and task creator when a task becomes blocked
-- Inserts urgent notifications for the task creator and all admins (excluding blocked admins)
-- Timestamp: 2026-04-30

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_on_task_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  creator_name text;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'blocked' AND (OLD.status IS DISTINCT FROM NEW.status)) THEN

      -- Get creator display name if present
      SELECT display_name INTO creator_name FROM profiles WHERE id = NEW.creator_id;

      -- Notify the task creator (if not blocked)
      IF EXISTS (SELECT 1 FROM profiles p WHERE p.id = NEW.creator_id AND COALESCE(p.is_blocked, false) = false) THEN
        INSERT INTO notifications (recipient_id, type, title, body, task_id, is_urgent, is_read, created_at)
        VALUES (
          NEW.creator_id,
          'blocker',
          'Your task was marked blocked',
          COALESCE('Your task "' || NEW.title || '" was marked blocked. ' || COALESCE(NEW.blocker_reason, ''), 'A task was marked blocked.'),
          NEW.id,
          TRUE,
          FALSE,
          NOW()
        );
      END IF;

      -- Notify all admins (exclude blocked admins and the creator)
      INSERT INTO notifications (recipient_id, type, title, body, task_id, is_urgent, is_read, created_at)
      SELECT ur.user_id,
             'blocker',
             'Blocked task reported',
             'Task "' || NEW.title || '" by ' || COALESCE(creator_name, 'Unknown') || ' was marked blocked: ' || COALESCE(NEW.blocker_reason, ''),
             NEW.id,
             TRUE,
             FALSE,
             NOW()
      FROM user_roles ur
      JOIN profiles p ON p.id = ur.user_id
      WHERE ur.role = 'admin'
        AND COALESCE(p.is_blocked, false) = false
        AND ur.user_id IS NOT NULL
        AND ur.user_id <> NEW.creator_id;

    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_notify_on_blocked
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'blocked')
EXECUTE FUNCTION public.notify_on_task_blocked();

COMMIT;
