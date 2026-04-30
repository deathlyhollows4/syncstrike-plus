## Goal

Close the overly-permissive Realtime topic policy that lets any authenticated user subscribe to any `tasks%` / `tasks-%` topic on `realtime.messages`. The fix is database-only — the app does not need code changes.

## Why this is safe to tighten

Every `supabase.channel(...)` call in the app uses `postgres_changes` events:

```text
src/routes/_app/teams.tsx          channel("teams-rt")        postgres_changes on teams + team_members
src/routes/_app/tasks.tsx          channel("tasks-list-rt")   postgres_changes on tasks
src/routes/_app/dashboard.tsx      channel("tasks-rt")        postgres_changes on tasks
src/routes/_app/chat.tsx           channel(`chat-${teamId}`)  postgres_changes on chat_messages
src/components/NotificationBell    channel(`notif-${userId}`) postgres_changes on notifications
```

`postgres_changes` payloads are filtered server-side by each table's regular RLS policies (already correct: tasks SELECT requires creator/assignee/team-member/admin, notifications SELECT requires recipient, chat requires team membership, etc.). They do NOT depend on the `realtime.messages` topic policy.

The `realtime.messages` topic policy only matters for **broadcast** and **presence** events, which the app does not use. So we can remove the broad `tasks%` / `tasks-%` allowances without breaking any feature.

## Database migration

Replace the `syncstrike realtime read` and `syncstrike realtime write` policies on `realtime.messages` so that:

- Admins keep full access.
- Per-user notification topic stays allowed: `notifications:<auth.uid()>`.
- Team chat topic stays allowed: `chat:<team_id>` only when `is_team_member(auth.uid(), team_id)`.
- Tasks topics are scoped: only `tasks:user:<auth.uid()>` (own bucket) or `tasks:team:<team_id>` (only when the user is a member of that team) are allowed. Plain `tasks%` / `tasks-%` wildcards are removed.
- Anything else falls through to deny.

```sql
DROP POLICY IF EXISTS "syncstrike realtime read"  ON realtime.messages;
DROP POLICY IF EXISTS "syncstrike realtime write" ON realtime.messages;

CREATE POLICY "syncstrike realtime read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR realtime.topic() = 'notifications:' || auth.uid()::text
    OR realtime.topic() = 'tasks:user:'    || auth.uid()::text
    OR (
      realtime.topic() LIKE 'tasks:team:%'
      AND public.is_team_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 3), '')::uuid
      )
    )
    OR (
      realtime.topic() LIKE 'chat:%'
      AND public.is_team_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    )
  );

-- Mirror the same predicate for INSERT (broadcast send / presence track).
CREATE POLICY "syncstrike realtime write" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK ( /* same expression as above */ );
```

## Security findings

- Mark `realtime_tasks_channel_open` as fixed with explanation referencing the new tightly-scoped topic policy and the fact that all live data flow uses `postgres_changes`, which is already filtered by table RLS.
- Update the security memory to record that Realtime topic ACL is the deny-by-default kind: only `notifications:<uid>`, `tasks:user:<uid>`, `tasks:team:<team_id>` (member only), and `chat:<team_id>` (member only) are allowed; admins bypass.

## Files touched

- New migration: `supabase/migrations/<timestamp>_realtime_scope_tasks_topics.sql`
- `manage_security_finding` → mark fixed
- `update_memory` → refresh security notes

No frontend changes, no new edge functions, no schema changes.
