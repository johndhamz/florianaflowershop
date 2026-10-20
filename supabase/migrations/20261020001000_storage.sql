-- ============================================================================
-- 1000 · Storage buckets
--   product-images  : public read, admins write
--   payment-proofs  : private; uploads only via server (service_role),
--                     admins/support read
--   content-media   : public read (site content), admins write
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true,  5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('content-media',  'content-media',  true,  8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "product images public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');
create policy "product images admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and app.is_admin());
create policy "product images admin update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and app.is_admin());
create policy "product images admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and app.is_admin());

create policy "content media public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'content-media');
create policy "content media admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'content-media' and app.is_admin());
create policy "content media admin update" on storage.objects
  for update to authenticated using (bucket_id = 'content-media' and app.is_admin());
create policy "content media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'content-media' and app.is_admin());

create policy "payment proofs staff read" on storage.objects
  for select to authenticated using (bucket_id = 'payment-proofs' and app.has_role('owner', 'manager', 'support'));
create policy "payment proofs admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'payment-proofs' and app.is_admin());
