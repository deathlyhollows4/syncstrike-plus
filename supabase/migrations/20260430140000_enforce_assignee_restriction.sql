-- Migration: Enforce assignee restrictions for non-admins
-- Non-admins can only assign tasks to themselves; admins can assign to anyone
-- Timestamp: 2026-04-30

BEGIN;

-- Function to validate assignee_id on task insert/update
CREATE OR REPLACE FUNCTION public.tasks_validate_assignee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only admins can set assignee_id to someone other than themselves
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id != auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can assign tasks to other users';
  END IF;
  RETURN NEW;
END $$;

-- Trigger on tasks table for assignee validation
DROP TRIGGER IF EXISTS tasks_validate_assignee_trg ON public.tasks;
CREATE TRIGGER tasks_validate_assignee_trg BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_validate_assignee();

COMMIT;