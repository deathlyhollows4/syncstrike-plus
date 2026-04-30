## Goals

1. Fix the broken `/reset-password` page so users can actually set a new password.
2. Build a full, production-ready **Teams** page (admins manage teams + members; members view their teams).
3. Wire team awareness through the rest of the app so the data already in Supabase is actually usable: team picker on tasks, real-time **Chat**, team filter on Dashboard/Analytics, and Notifications/profile improvements.

No DB schema changes are required — the schema (`teams`, `team_members`, `tasks.team_id`, `chat_messages`) and RLS already support all of this.

---

## 1. Fix `/reset-password`

**Problem:** the page only renders the password form when `ready` becomes true, set inside `onAuthStateChange` on `PASSWORD_RECOVERY`/`SIGNED_IN`. When the user lands from the email link the token in the URL hash is processed by Supabase before the listener attaches, so the event is missed and the form never shows — the user just sees the "Open this page from the password-reset email link…" placeholder.

**Fix in `src/routes/reset-password.tsx`:**
- Initialise `ready` from a synchronous URL-hash check: if the hash contains `type=recovery` or `access_token=`, set `ready = true` immediately.
- Also flip `ready = true` when `getSession()` returns a session (already there) AND on `INITIAL_SESSION` events.
- Keep the `PASSWORD_RECOVERY` / `SIGNED_IN` listener as a fallback.
- After successful `updateUser({ password })`, sign the user out and redirect to `/login` with a success toast (so they re-authenticate cleanly with the new password) instead of dropping them straight into `/dashboard`.
- Add a confirm-password field and matching validation.

---

## 2. Teams page (`src/routes/_app/teams.tsx`)

Replace the current "Coming up next" stub with a real page.

### Layout

```text
+------------------------------------------------+
| Teams                            [+ New team]  |  (admin only button)
+----------------+-------------------------------+
| Team list      | Selected team detail          |
| - Alpha   (5)  |  Name, description            |
| - Beta    (3)  |  Owner, created date          |
| - ...          |                               |
|                |  Members                      |
|                |  ┌──────────────────────────┐ |
|                |  | avatar  name   role  [x] | |
|                |  | ...                      | |
|                |  └──────────────────────────┘ |
|                |  [+ Add member]   (admin)     |
|                |                               |
|                |  Recent team tasks (last 5)   |
|                |  Open team chat -> /chat?team=|
+----------------+-------------------------------+
```

### Behaviour
- **Member view:** lists teams the user belongs to (RLS already filters). Selecting a team shows its info, member roster (display name + email when allowed), and a quick link to the team's chat.
- **Admin view:** same UI plus:
  - "New team" dialog → inserts into `teams` with `owner_id = auth.uid()`, then auto-inserts the owner into `team_members`.
  - "Add member" dialog → searches `profiles` by email/display_name and inserts into `team_members`. Prevents duplicates.
  - Per-member remove (trash icon) → deletes from `team_members`.
  - Edit team name/description (inline) and delete team (with confirm).
- Realtime: subscribe to `teams` and `team_members` channels so changes update without refresh.
- Loading skeletons + empty states styled to match the existing black/gold editorial design.

---

## 3. Cross-project integrations

### TaskCreateModal — team picker
- Load teams the user is a member of (or all teams if admin) and render a "Team" select (optional, defaults to "Personal / no team"). Persist as `team_id`.
- Add an optional "Assignee" select populated from team members of the chosen team (admins see all profiles).

### Chat page (`src/routes/_app/chat.tsx`) — full realtime
Replace the placeholder with a working chat:
- Sidebar of teams the user belongs to; clicking selects a team. Reads `?team=<id>` query param so links from Teams page work.
- Main pane shows `chat_messages` for the selected team, ordered ascending, with sender name (joined from `profiles`).
- Input box posts to `chat_messages` with `sender_id = auth.uid()` and the selected `team_id`.
- Subscribe to `postgres_changes` on `chat_messages` filtered by `team_id` for live updates.
- Auto-scroll to bottom on new messages; show empty state when no team selected.

### Dashboard / Tasks / Analytics
- Tasks list: show team name badge when `team_id` is set (lookup map from teams the user can see).
- Analytics: add a "Team" filter dropdown (All / each team) that re-filters the existing stats.

### NotificationBell
- Verify it links each notification to its task (already wired) and add a "Mark all read" action that updates only the `is_read` flag (RLS-safe).

### Profile page
- Add display-name + avatar URL editing (writes to `profiles`, RLS already allows self-update).
- Show the user's teams as small chips.

### Admin page
- Add a "Teams" stat card next to the existing ones (count from `teams`).
- Quick link from each user row to "View teams" (filters Teams page to that user). Optional, low priority.

---

## Technical notes

- Files created: none new besides possibly `src/components/TeamCreateModal.tsx`, `src/components/AddMemberModal.tsx`, `src/components/ChatThread.tsx` to keep route files lean.
- Files edited: `src/routes/reset-password.tsx`, `src/routes/_app/teams.tsx`, `src/routes/_app/chat.tsx`, `src/routes/_app/analytics.tsx`, `src/routes/_app/tasks.tsx`, `src/routes/_app/profile.tsx`, `src/routes/_app/admin.tsx`, `src/components/TaskCreateModal.tsx`, `src/components/NotificationBell.tsx`.
- All Supabase access stays on the browser client using the user's session — RLS policies already in place enforce membership/admin rules, so no service-role calls are needed.
- Realtime channels are cleaned up on unmount via `supabase.removeChannel`.
- No migrations, no edge functions, no new secrets.

---

## Out of scope

- Inviting non-existing users by email (would require an edge function + invite tokens).
- File attachments in chat.
- Per-team roles beyond "member" (the schema doesn't model this yet).
