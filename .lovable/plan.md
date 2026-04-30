## Status check (good news)

Your database is fully intact — nothing was deleted:

| Table | Rows |
|---|---|
| profiles | 5 |
| user_roles | 5 (1 admin) |
| tasks | 11 |
| teams | 1 |
| chat_messages, notifications, team_members | present |

All tables, RLS policies, triggers, and security-definer functions from previous migrations are still in place. The previous security migration that errored out (500 from the type-generator) was rolled back — so no changes were applied either way. The admin page source (`src/routes/_app/admin.tsx`) and the sidebar Admin link (`src/routes/_app.tsx`) are also still in the codebase.

## Why "admin page is not showing"

The admin route is gated by `isAdmin` from `AuthContext`. There are two real failure modes I want to harden:

1. **Race condition on first load** — `AuthContext.fetchRole` sets `loading=false` only inside the initial `getSession()` resolver. If the `onAuthStateChange` listener fires first (which often happens on hard refresh of `/admin`), `loading` can stay `true` indefinitely → admin page stuck on the skeleton, sidebar Admin link never appears.
2. **Block-status check failure** — `fetchRole` reads `profiles.is_blocked`. If that read fails (e.g. transient network hiccup, RLS edge case), it currently silently returns and `role` stays `null` forever, hiding the Admin link permanently for that session.

## Plan

### 1. Fix `AuthContext` so role + loading always resolve
- Make `fetchRole` resilient: on any error, fall back to reading `user_roles` directly and clear `loading` regardless.
- Always set `loading=false` after the first auth event (listener OR `getSession`), whichever wins the race — not only inside `getSession().then()`.
- Re-fetch role on `SIGNED_IN` / `TOKEN_REFRESHED` events so a freshly promoted user sees the Admin link without re-login.

### 2. Re-apply the security hardening (the previous attempt errored on type generation, not SQL)
Same migration as last turn, in one shot:
- **Profiles INSERT policy** — only `id = auth.uid()` (closes spoofing).
- **Length CHECK constraints** on `chat_messages.body`, `tasks.title/description/completion_description/blocker_reason`, `profiles.display_name/avatar_url/email`.
- **Trigger** `profiles_lock_sensitive_fields` — non-admins cannot change `is_blocked`, `email`, or `id` on any profile (closes the privilege-escalation finding).

### 3. Quick sanity sweep (no behavioral changes)
- Verify `/admin` route file naming matches `src/routes/_app/admin.tsx` (it does).
- Verify the Admin sidebar link renders only when `isAdmin === true` (it does).
- Add a tiny "Refresh role" affordance is **not** needed; the listener fix covers it.

## Files touched

- `src/context/AuthContext.tsx` — robust role + loading handling
- New SQL migration — INSERT policy, length checks, sensitive-field trigger

## What you'll see after

- Admin link reliably appears in the sidebar on every refresh for the admin user.
- `/admin` loads the dashboard with all 5 users, 11 tasks, 1 team.
- All three open security findings flip to fixed.
- No data loss anywhere — your existing tasks, users, teams, and chats remain.