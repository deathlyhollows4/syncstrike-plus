-- Tighten realtime.messages topic policies: remove broad tasks% allowance.
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

CREATE POLICY "syncstrike realtime write" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
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