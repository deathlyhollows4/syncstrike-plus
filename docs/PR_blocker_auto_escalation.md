# PR: Blocker Auto-Escalation

## Summary

This PR adds a database migration and client changes to automatically create urgent
notifications when a task transitions to `blocked`. It also includes CI, unit tests,
and an admin UI improvement for promoting/demoting users.

## Files changed

- `supabase/migrations/20260430120000_notify_on_blocker.sql` — new migration that creates
  a SECURITY DEFINER function + trigger to insert `notifications` when a task becomes blocked.
- `.github/workflows/ci.yml` — CI workflow to run lint, typecheck, tests and build.
- `src/routes/_app/admin.tsx` — add Promote / Demote actions for admin roles.
- `src/lib/audio.test.ts` & `package.json` — add Vitest and unit test for `playBeep()`.
- `vite.config.ts` — guard to make Vitest run without initializing TanStack Start plugin.

## Why

- Fulfills product promise: blocked tasks create urgent alerts for the creator and admins.
- Improves admin UX and adds basic unit test coverage + CI to catch regressions.

## Migration details

- Adds `public.notify_on_task_blocked()` (SECURITY DEFINER) and `task_notify_on_blocked` trigger
  that fires AFTER UPDATE on `tasks` when `status` changes to `blocked`.
- The function inserts a notification for the task creator (unless blocked) and for all admin users.

## Verification steps (staging)

1. Confirm trigger/function exists

```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = 'tasks'::regclass;
SELECT proname FROM pg_proc WHERE proname = 'notify_on_task_blocked';
```

2. Pick a real task id (no angle brackets):

```sql
SELECT id, title, status FROM tasks ORDER BY created_at DESC LIMIT 5;
```

3. Transactional test (safe): replace `PUT_TASK_UUID_HERE` with a real id

```sql
BEGIN;
UPDATE tasks SET status = 'blocked', blocker_reason = 'verify migration' WHERE id = 'PUT_TASK_UUID_HERE';
SELECT * FROM notifications WHERE task_id = 'PUT_TASK_UUID_HERE' ORDER BY created_at DESC;
ROLLBACK;
```

4. Realtime smoke test (non-transactional):

```sql
UPDATE tasks SET status = 'blocked', blocker_reason = 'realtime test' WHERE id = 'PUT_TASK_UUID_HERE';
```

Then open the app (pointed at staging env) logged in as an admin and verify the NotificationBell shows a new urgent notification.

## Rollback

To remove the trigger/function if needed:

```sql
DROP TRIGGER IF EXISTS task_notify_on_blocked ON tasks;
DROP FUNCTION IF EXISTS public.notify_on_task_blocked();
```

## Deployment plan

1. Merge PR after review and CI is green.
2. Apply migration to production during a short maintenance window (run SQL in Supabase UI or via psql using production DB URL).
3. Smoke test production: mark a task blocked and confirm notifications and realtime behavior.

## Notes

- The SQL migration must be run with a role that can create SECURITY DEFINER functions and create triggers. Use Supabase project SQL editor or a db user with sufficient privileges.
- DO NOT run production migration without a DB snapshot/backup and a brief maintenance window.
