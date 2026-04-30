# Production Rollout: Blocker Auto-Escalation

## Summary

This document describes the safe production rollout for the blocker auto-escalation
migration added in `supabase/migrations/20260430120000_notify_on_blocker.sql`.

## Pre-Deployment Checklist

- Confirm CI is green on `feat/blocker-auto-escalation` and all tests pass.
- Create a full production DB snapshot/backup (Supabase -> Backups or pg_dump).
- Identify deployment owner and a backup owner (who can restore the DB).
- Schedule a short maintenance window (recommended 5–15 minutes). Notify stakeholders.
- Ensure you have a production DB connection string (only share securely).
- Confirm you (or the operator) can run SQL in the Supabase SQL editor or have psql access.

## Deployment Steps (preferred: Supabase SQL editor)

1. Merge the PR after final review and confirm `main` is up-to-date and CI passed.
2. Open Supabase project → **SQL editor**.
3. Copy the contents of `supabase/migrations/20260430120000_notify_on_blocker.sql` and run it.
   - Do NOT include shell commands like `export` or `psql` — paste SQL only.

Alternative: Run via psql (if you have DB URL and psql installed):

```bash
export SUPABASE_DB_URL="postgresql://USER:PASS@HOST:PORT/DB"
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260430120000_notify_on_blocker.sql
```

Alternative (no psql install): using Docker:

```bash
export SUPABASE_DB_URL="postgresql://USER:PASS@HOST:PORT/DB"
docker run --rm -v "$PWD":/work -w /work postgres:16 \
  psql "$SUPABASE_DB_URL" -f supabase/migrations/20260430120000_notify_on_blocker.sql
```

## Verification (production)

Run these queries in the production SQL editor immediately after applying the migration:

1. Confirm trigger & function exist:

```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = 'tasks'::regclass;
SELECT proname FROM pg_proc WHERE proname = 'notify_on_task_blocked';
```

2. Pick a recent non-blocked task id to test (copy a real UUID from result):

```sql
SELECT id, title, status FROM tasks ORDER BY created_at DESC LIMIT 10;
```

3. Transactional (safe) test — use the chosen id (replace UUID):

```sql
BEGIN;
UPDATE tasks SET status = 'blocked', blocker_reason = 'production verification' WHERE id = 'PUT_TASK_UUID_HERE';
SELECT id, recipient_id, type, title, body, is_urgent, is_read, created_at
FROM notifications
WHERE task_id = 'PUT_TASK_UUID_HERE'
ORDER BY created_at DESC;
ROLLBACK;
```

Expected: at least one notification for the task creator and notifications for admins with `is_urgent = true`.

4. Realtime smoke test (non-transactional) — to exercise subscribers:

```sql
-- record current status first
SELECT status FROM tasks WHERE id = 'PUT_TASK_UUID_HERE';

-- set blocked (non-transactional)
UPDATE tasks SET status = 'blocked', blocker_reason = 'realtime smoke test' WHERE id = 'PUT_TASK_UUID_HERE';

-- inspect notifications
SELECT * FROM notifications WHERE task_id = 'PUT_TASK_UUID_HERE' ORDER BY created_at DESC;

-- restore original status (if needed)
UPDATE tasks SET status = '<OLD_STATUS>' WHERE id = 'PUT_TASK_UUID_HERE';
```

## Front-end smoke test

- Point your local dev (or an admin browser) to production env vars carefully (prefer read-only checks). Better: log into production web UI as an admin.
- Trigger the non-transactional update above and confirm the NotificationBell displays the urgent notification.

## Rollback Plan

If you must stop new auto-notifications immediately:

```sql
DROP TRIGGER IF EXISTS task_notify_on_blocked ON tasks;
DROP FUNCTION IF EXISTS public.notify_on_task_blocked();
```

If you need to remove notifications created by the migration/test window, run a targeted delete (be cautious):

```sql
-- Delete blocker notifications created in the last N minutes (adjust interval)
DELETE FROM notifications WHERE type = 'blocker' AND created_at >= NOW() - INTERVAL '15 minutes';
```

## Monitoring after rollout

- Watch application logs and Supabase logs for errors (Supabase -> Logs).
- Monitor incoming notification counts (query `notifications` table) and user reports.
- Check for unexpected duplicated notifications and investigate user_roles/profile data.

## Post-Deployment

- Leave the rollout status in the tracking TODO list and update when fully complete.
- Consider a follow-up PR to add an integration test that simulates the task status change and asserts notifications (longer-term improvement).

## Contact

If you want me to perform any of these steps (merge, run migration, verify), provide the confirmed production DB access method (prefer Supabase SQL editor or run via your operations account). I will not accept production service-role keys in chat; use secure channels if needed.
