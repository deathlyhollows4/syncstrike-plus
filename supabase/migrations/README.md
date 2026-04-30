# Migration: 20260430120000_notify_on_blocker.sql

This migration creates a trigger and SECURITY DEFINER function that inserts urgent
notifications when a task transitions to `blocked`.

Files:

- `supabase/migrations/20260430120000_notify_on_blocker.sql` — the SQL migration

Important: Always run this on a non-production (staging) environment first and
take a DB snapshot/backup before applying to production.

## How to apply

Option A — Supabase SQL editor (recommended for quick staging runs):

1. Open your Supabase project dashboard > SQL Editor
2. Paste the contents of `20260430120000_notify_on_blocker.sql` and run

Option B — psql (requires DB connection string):

```bash
# Export your staging DB connection string (obtain from Supabase Project Settings)
export SUPABASE_DB_URL="postgresql://postgres:password@db.host:5432/postgres"
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260430120000_notify_on_blocker.sql
```

## Verification

Use the following queries to verify the trigger exists and the notification insertion works.

1. Confirm trigger/function created:

```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = 'tasks'::regclass;
-- expect: task_notify_on_blocked

SELECT proname FROM pg_proc WHERE proname = 'notify_on_task_blocked';
```

2. Test the trigger safely (run inside a transaction and ROLLBACK to avoid persisting changes):

```sql
BEGIN;
-- Replace <TASK_ID> with a real task id in staging
UPDATE tasks SET status = 'blocked', blocker_reason = 'migration verification' WHERE id = '<TASK_ID>';
SELECT * FROM notifications WHERE task_id = '<TASK_ID>' ORDER BY created_at DESC;
ROLLBACK;
```

Expected: You should see at least one `notifications` row for the task creator (recipient_id = creator_id),
and rows for admin users (role = 'admin'). Rows will have `is_urgent = true`.

3. Inspect recipients:

```sql
SELECT user_id FROM user_roles WHERE role = 'admin';
SELECT * FROM profiles WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'admin');
```

## Rollback (if needed)

If you must revert the migration, run:

```sql
DROP TRIGGER IF EXISTS task_notify_on_blocked ON tasks;
DROP FUNCTION IF EXISTS public.notify_on_task_blocked();
```

## Notes & Safety

- The function uses `SECURITY DEFINER` so it can insert into `notifications` even when RLS is enabled.
- It avoids notifying blocked users and avoids duplicating notification for the task creator when they are an admin.
- Test on staging and monitor the `notifications` table and realtime channels during verification.
