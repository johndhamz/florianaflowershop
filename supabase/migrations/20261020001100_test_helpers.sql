-- ============================================================================
-- 1100 · Test helpers (schema `tests`): JWT/role impersonation for pgTAP.
-- Not reachable through the API (no grants to anon/authenticated).
-- ============================================================================
create schema if not exists tests;
revoke all on schema tests from public, anon, authenticated;

-- Impersonate a signed-in user exactly as PostgREST would: switch the SQL role
-- and populate the JWT claim settings that auth.uid()/auth.role() read.
create or replace function tests.login_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.login_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end $$;

create or replace function tests.login_service()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  execute 'set local role service_role';
end $$;

create or replace function tests.logout()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end $$;

-- Impersonated sessions must be able to log back out. The `tests` schema is not
-- exposed through PostgREST, so these grants are unreachable from the API.
grant usage on schema tests to anon, authenticated, service_role;
grant execute on function tests.logout() to anon, authenticated, service_role;
