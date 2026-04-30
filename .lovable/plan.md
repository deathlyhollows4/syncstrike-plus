I found the main cause: the data is still in the database, but a previous security hardening change revoked execute access on the database helper functions used inside RLS policies (`is_admin`, `is_blocked`, `is_team_member`, `has_role`). That makes normal authenticated reads fail or return nothing for Teams, Chat, Admin, etc.

Current database check confirms the data is still present:

```text
profiles: 5
user_roles: 5
teams: 1
team_members: 4
tasks: 11
chat_messages: 5
notifications: 7
```

Your account `vidhantomar2004@gmail.com` is also still present and has the `admin` role. The problem is access/functionality, not deleted data.

Plan to fix everything:

1. Restore database access safely
   - Add a migration that restores `EXECUTE` permission for authenticated users on the RLS helper functions required by policies.
   - Rework those helper functions so they remain safe when callable: users can only check themselves unless they are admin, while RLS policies continue to work.
   - Keep trigger-only helper functions locked down.

2. Restore Admin page behavior
   - Ensure your admin role resolves reliably after login/refresh.
   - Make the Admin link and `/admin` page render once the role is known.
   - Keep non-admin users blocked from admin UI and admin queries.

3. Fix Teams page
   - Ensure team list, members, owner, add-member, edit, and delete actions work again under the corrected RLS helper permissions.
   - Add visible error messages instead of silently showing empty UI if a database query fails.
   - Add Teams and Team Members to realtime publication so team changes update correctly.

4. Fix Chat page
   - Ensure teams load for the user, messages load for selected team, and message sending works again.
   - Add proper error handling/toasts for failed team/message/profile queries.
   - Keep chat scoped to team members/admins through RLS.

5. Clean up security/bug regressions from previous fixes
   - Remove duplicate length constraints where the same checks were added twice.
   - Remove the duplicate blocked-task notification trigger so blocked tasks do not create duplicate notifications.
   - Fix the latest scan finding: `src/integrations/supabase/auth-middleware.ts` currently returns missing environment variable names in HTTP 500 responses. I will change it to log details server-side only and return a generic safe message to clients.

6. Verify after implementation
   - Re-run the security scan and mark the finding fixed if resolved.
   - Re-check row counts and your admin role.
   - Verify `/admin`, `/teams`, and `/chat` load from the app code path.
   - Confirm the preview is ready for publish. If the platform allows publishing from this session I’ll do it; otherwise I’ll tell you exactly when it is safe to click Publish.

I understand the frustration about credits. The priority now is to stop guessing, fix the actual broken access layer, and preserve both the original functionality and the new avatar/security work.