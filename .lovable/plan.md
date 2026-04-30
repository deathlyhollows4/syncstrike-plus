# Bug Fixes, Security Hardening & Avatar Feature

## 1. Avatar feature (end-to-end)

Today the user can save `avatar_url` on the profile page, but the image is not displayed anywhere. I will wire it through every place a user is identified.

**A reusable `<UserAvatar>` component** (`src/components/UserAvatar.tsx`) built on the existing shadcn `Avatar` primitive:
- Props: `url`, `name`, `email`, `size` (`sm | md | lg`).
- Shows `<AvatarImage>` when `url` is set, otherwise `<AvatarFallback>` with the first letter of name/email on the gold gradient (matching current sidebar style).

**A small `useProfiles(ids)` hook** (`src/hooks/useProfiles.ts`) that batch-fetches `id, display_name, avatar_url, email` from `profiles` and caches them in a module-level Map so chat / tasks / admin don't refetch the same user repeatedly.

**Wire-up locations:**
- `src/routes/_app.tsx` — sidebar user card + header (replace the hand-rolled gold initial circle).
- `src/routes/_app/profile.tsx` — preview avatar above the form; show live preview as user edits the URL.
- `src/routes/_app/chat.tsx` — message bubbles (left of each message, sized `sm`).
- `src/routes/_app/teams.tsx` — member rows.
- `src/routes/_app/admin.tsx` — user table "User" column.
- `src/components/TaskDetailModal.tsx` — assignee + creator rows.
- `src/components/TaskCreateModal.tsx` — assignee dropdown options.

**Validation:** in `saveProfile`, accept only `https://…` URLs (or empty) and cap at 500 chars before sending to Supabase. Show a toast for invalid input.

## 2. Bug fixes

- **Profile search-param bypass:** `profile.tsx` reads `window.location.search` directly, which breaks SSR and is flagged by the scanner. Switch to `validateSearch` on the route declaring `{ id?: string }` and read it via `Route.useSearch()`. Validate the ID looks like a UUID before querying.
- **TaskDetailModal:** also fetch + show the *creator* profile (currently only assignee), and use `<UserAvatar>`.
- **Avatar input UX:** trim whitespace, normalize empty string → `null`, and show a tiny inline preview under the input.
- **Chat sender fallback:** when a profile fetch fails, current code shows "Unknown". Fall back to a shortened user-id so messages aren't ambiguous in dev.
- **Admin route:** confirm the loading-skeleton fix from the previous turn is still in place (verified) and that non-admins are redirected before any admin query fires.

## 3. Security findings (from latest scan)

I'll fix the items that have a clear, low-risk remediation; the rest get documented in the security memory with rationale.

**Will fix via SQL migration:**

- **Blocked users can update their own profile** — add `AND NOT public.is_blocked(auth.uid())` to the `users update own profile` policy on `profiles` (USING + WITH CHECK).
- **Blocked users can delete their own notifications** — add `AND NOT public.is_blocked(auth.uid())` to the recipient branch of `recipient or admin deletes` on `notifications`.
- **`SECURITY DEFINER` functions executable by anon/authenticated** — `REVOKE EXECUTE … FROM PUBLIC, anon` on `has_role`, `is_admin`, `is_team_member`, `is_blocked`. They are only called from RLS policies and triggers (which run as the function owner), so revoking public EXECUTE is safe and silences 10 of 16 findings. Trigger-only helpers (`handle_new_user`, `tasks_validate`, `tasks_lock_creator`, `notifications_lock_fields`, `notify_on_blocker`, `notify_on_task_blocked`) get `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`.

**Will document as accepted risk in `security--update_memory`:**

- **Session in `localStorage` (`SESSION_LOCALSTORAGE`)** — switching to HttpOnly cookies requires a custom server-side auth bridge that's out of scope for this round. Mitigations already in place: strict React (no `dangerouslySetInnerHTML`), no third-party script tags, RLS on every table.
- **Missing CSP / security headers (`NO_CSP_SECURITY_HEADERS`)** — would require adding TanStack Start middleware; can be tackled as its own task. Documenting current posture.
- **Auth checks in `useEffect` (`ROUTE_ONLY_AUTH_CLIENT_SIDE`)** — moving to `beforeLoad` requires plumbing the auth context into the router context, which is a larger refactor touching `__root.tsx`, `router.tsx`, and every protected route. Will note as a follow-up; current pattern still enforces RLS server-side, so data is never actually exposed — only a brief flash of empty UI.

I'll also call `security--manage_security_finding` with `mark_as_fixed` for the two RLS findings and the SECURITY DEFINER findings.

## 4. Republish

After verification, surface a publish action so you can push the changes live.

## Out of scope (will mention but not do)

- HttpOnly cookie auth migration.
- Global CSP/security-header middleware.
- Migrating all auth guards from `useEffect` to `beforeLoad`.
- File uploads for avatars (still URL-based per current schema; Cloud storage bucket would be a separate feature).

## Technical summary

- **New files:** `src/components/UserAvatar.tsx`, `src/hooks/useProfiles.ts`, one new SQL migration under `supabase/migrations/`.
- **Edited files:** `src/routes/_app.tsx`, `src/routes/_app/profile.tsx`, `src/routes/_app/chat.tsx`, `src/routes/_app/teams.tsx`, `src/routes/_app/admin.tsx`, `src/components/TaskDetailModal.tsx`, `src/components/TaskCreateModal.tsx`.
- **Tools called after edits:** `security--manage_security_finding` (mark_as_fixed × findings above), `security--update_memory` (record accepted risks).
