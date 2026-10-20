-- ============================================================================
-- Seed 04 · Delivery zones, slots, promo codes, business settings, site content
-- ============================================================================

insert into public.delivery_zones (id, slug, name, city, barangays, fee_centavos, free_delivery_threshold_centavos, min_order_centavos, same_day_cutoff, lead_time_hours, position) values
  ('70000000-0000-4000-8000-000000000001', 'cebu-city-central', 'Cebu City · Central', 'Cebu City',
   array['Lahug','Capitol Site','Kamputhaw','Luz','Mabolo','Hipodromo','Carreta','Tejero','Sambag I','Sambag II','Guadalupe','Banilad','Apas','Kasambagan','Cogon Ramos','Santo Niño','Ermita','Parian','San Nicolas Proper'],
   9900, 300000, 0, '14:00', 3, 1),
  ('70000000-0000-4000-8000-000000000002', 'cebu-city-outer', 'Cebu City · Outer', 'Cebu City',
   array['Talamban','Pit-os','Bacayan','Busay','Budlaan','Labangon','Punta Princesa','Tisa','Pardo','Bulacao','Inayawan','Mambaling','Basak San Nicolas','Quiot'],
   14900, 400000, 0, '13:00', 4, 2),
  ('70000000-0000-4000-8000-000000000003', 'mandaue', 'Mandaue City', 'Mandaue City',
   array['Centro','Banilad','Cabancalan','Casuntingan','Subangdaku','Tipolo','Umapad','Maguikay','Basak','Alang-Alang','Bakilid','Looc','Mantuyong','Opao'],
   14900, 400000, 0, '13:00', 4, 3),
  ('70000000-0000-4000-8000-000000000004', 'lapu-lapu', 'Lapu-Lapu City (Mactan)', 'Lapu-Lapu City',
   array['Pusok','Basak','Marigondon','Agus','Mactan','Gun-ob','Pajo','Ibo','Maribago','Punta Engaño','Subabasbas','Bankal'],
   19900, 500000, 100000, '12:00', 6, 4),
  ('70000000-0000-4000-8000-000000000005', 'talisay-minglanilla', 'Talisay & Minglanilla', 'Talisay City',
   array['Tabunok','Lawaan I','Lawaan II','Lawaan III','Bulacao','Linao','Poblacion','San Isidro','Tangke','Tunghaan','Pakigne','Calajoan'],
   19900, 500000, 100000, null, 24, 5),
  ('70000000-0000-4000-8000-000000000006', 'consolacion-liloan', 'Consolacion & Liloan', 'Consolacion',
   array['Poblacion Oriental','Poblacion Occidental','Lamac','Nangka','Pitogo','Tayud','Jubay','Yati','Catarman','Cotcot','San Vicente'],
   24900, null, 150000, null, 24, 6);

insert into public.delivery_slots (id, label, starts_at, ends_at, days_of_week, default_capacity, position) values
  ('80000000-0000-4000-8000-000000000001', 'Morning (9 AM – 12 NN)',   '09:00', '12:00', '{1,2,3,4,5,6}', 12, 1),
  ('80000000-0000-4000-8000-000000000002', 'Afternoon (1 PM – 5 PM)',  '13:00', '17:00', '{1,2,3,4,5,6}', 14, 2),
  ('80000000-0000-4000-8000-000000000003', 'Evening (5 PM – 8 PM)',    '17:00', '20:00', '{1,2,3,4,5}',    6, 3),
  ('80000000-0000-4000-8000-000000000004', 'Sunday (10 AM – 2 PM)',    '10:00', '14:00', '{0}',            8, 4);

insert into public.promo_codes (id, code, description, promo_type, value, min_subtotal_centavos, max_discount_centavos, starts_at, ends_at, max_uses) values
  ('90000000-0000-4000-8000-000000000001', 'LOLA10',    '10% off, up to ₱300',             'percent', 10,  100000, 30000, now() - interval '1 day', now() + interval '90 days', 500),
  ('90000000-0000-4000-8000-000000000002', 'FIRSTBLOOM','₱150 off first orders over ₱1,000','fixed',   15000, 100000, null, now() - interval '1 day', null, null),
  ('90000000-0000-4000-8000-000000000003', 'EXPIRED5',  'Expired test code',                'percent', 5,   0,      null, now() - interval '30 days', now() - interval '1 day', null);

insert into public.business_settings (id, contact_email, contact_phone, address, bank_transfer_instructions, social) values
  (1, 'hello@florianaflowers.ph', '+639170000000', 'Lahug, Cebu City, Cebu 6000',
   'Transfer the exact total to BPI 1234-5678-90 (Floriana Flowers) or GCash 0917 000 0000, then upload a screenshot of the receipt. We confirm within 2 hours during shop hours (8 AM – 6 PM).',
   '{"instagram":"https://instagram.com/florianaflowers","facebook":"https://facebook.com/florianaflowers"}'::jsonb);

insert into public.site_content (key, data, is_published) values
  ('home.hero', '{"eyebrow":"Same-day delivery before 2 PM","title":"Love, in every bloom.","body":"Everyday flowers, premium bouquets and orchid gifts from a small Cebu studio named after an 86-year-old lola who still tends her orchids each morning.","cta_primary":{"label":"Shop flowers","href":"/shop"},"cta_secondary":{"label":"Orchid gifts","href":"/collections/lolas-orchid-collection"},"image_path":"home/hero.jpg"}'::jsonb, true),
  ('home.story', '{"eyebrow":"Our story","title":"Named after Lola Floriana, 86, and her orchids","body":"Floriana is the owner''s lola. At 86 she still loves caring for her orchids. We started Floriana Flowers to share that same patience with Cebu.","image_path":"home/lola.jpg","cta":{"label":"Read our story","href":"/our-story"}}'::jsonb, true),
  ('about.story', '{"title":"Our story","paragraphs":["Floriana Flowers is named after the owner''s lola, Floriana, who is 86 years old and continues to love caring for her orchids.","We are a small, delivery-first flower studio in Cebu. We pair affordable everyday flowers with premium bouquets, orchid gifts and elegant arrangements.","Every stem we send is batch-dated, conditioned and wrapped by hand."]}'::jsonb, true),
  ('delivery.info', '{"title":"Delivery information","body":"We deliver across Cebu City, Mandaue, Lapu-Lapu, Talisay, Minglanilla, Consolacion and Liloan. Same-day delivery is available in selected zones for orders placed before the cutoff. Choose a time slot at checkout; we will message the recipient 30 minutes before arrival."}'::jsonb, true),
  ('faqs', '{"items":[{"q":"Do you deliver same day?","a":"Yes, within Cebu City for orders placed before 2 PM, subject to slot availability."},{"q":"Can I include a message?","a":"Yes. Add a gift message at checkout; we write it on a Floriana card."},{"q":"What if the recipient is not home?","a":"Our rider will call the recipient and sender. We can leave flowers with a guard or neighbour on your instruction."},{"q":"How do I care for my orchid?","a":"Soak the roots once a week for 10 minutes, drain fully, and keep it in bright, indirect light."}]}'::jsonb, true),
  ('contact', '{"email":"hello@florianaflowers.ph","phone":"+63 917 000 0000","hours":"Monday to Saturday, 8 AM – 6 PM","address":"Lahug, Cebu City"}'::jsonb, true),
  ('home.announcement', '{"text":"Valentine''s pre-orders open 1 February."}'::jsonb, false);
