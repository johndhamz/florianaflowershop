-- ============================================================================
-- Seed 01 · Staff accounts (LOCAL/DEV ONLY — password for all: Floriana!2026)
-- ============================================================================
-- Fixed UUIDs so tests and other seeds can reference them.
--   owner    a0000000-0000-4000-8000-000000000001  owner@floriana.local
--   manager  a0000000-0000-4000-8000-000000000002  manager@floriana.local
--   florist  a0000000-0000-4000-8000-000000000003  florist@floriana.local
--   rider    a0000000-0000-4000-8000-000000000004  rider@floriana.local
--   support  a0000000-0000-4000-8000-000000000005  support@floriana.local

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token, is_sso_user, is_anonymous
)
select
  u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email,
  extensions.crypt('Floriana!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', u.display_name),
  now(), now(), '', '', '', '', '', '', '', '', false, false
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'owner@floriana.local',   'Lola Floriana'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'manager@floriana.local', 'Bea Villanueva'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'florist@floriana.local', 'Nico Abellana'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'rider@floriana.local',   'Jun Cabahug'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'support@floriana.local', 'Mira Ouano')
) as u(id, email, display_name)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email like '%@floriana.local'
on conflict (provider_id, provider) do nothing;

insert into public.staff_profiles (user_id, role, display_name, phone) values
  ('a0000000-0000-4000-8000-000000000001', 'owner',   'Lola Floriana',  '+639170000001'),
  ('a0000000-0000-4000-8000-000000000002', 'manager', 'Bea Villanueva', '+639170000002'),
  ('a0000000-0000-4000-8000-000000000003', 'florist', 'Nico Abellana',  '+639170000003'),
  ('a0000000-0000-4000-8000-000000000004', 'rider',   'Jun Cabahug',    '+639170000004'),
  ('a0000000-0000-4000-8000-000000000005', 'support', 'Mira Ouano',     '+639170000005')
on conflict (user_id) do nothing;
