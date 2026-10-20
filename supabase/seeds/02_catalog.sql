-- ============================================================================
-- Seed 02 · Catalog: collections, occasions, tags, add-ons, products, variants
-- ============================================================================

insert into public.collections (id, slug, name, tagline, description, image_path, position) values
  ('c0000000-0000-4000-8000-000000000001', 'everyday-blooms',    'Everyday Blooms',          'Market-fresh bunches for any day of the week.',
   'Honest, affordable flowers for kitchen tables, desks and small thank-yous. Wrapped simply, delivered fresh.', 'collections/everyday-blooms.jpg', 1),
  ('c0000000-0000-4000-8000-000000000002', 'premium-bouquets',   'Premium Bouquets',         'Hand-tied, wrapped and finished for the big moments.',
   'Our signature hand-tied bouquets with imported and local blooms, finished in Floriana ivory paper and blush ribbon.', 'collections/premium-bouquets.jpg', 2),
  ('c0000000-0000-4000-8000-000000000003', 'lolas-orchid-collection', 'Lola''s Orchid Collection', 'Living gifts that keep blooming.',
   'Potted phalaenopsis and dendrobium orchids chosen the way Lola Floriana chooses hers: healthy roots, strong spikes, buds still to open.', 'collections/lolas-orchids.jpg', 3),
  ('c0000000-0000-4000-8000-000000000004', 'arrangements',       'Premium Arrangements',     'Vase and table pieces styled for homes and events.',
   'Low, lush and ready to place. Designed in reusable ceramic and glass vessels.', 'collections/arrangements.jpg', 4);

insert into public.occasions (id, slug, name, description, position) values
  ('d0000000-0000-4000-8000-000000000001', 'birthday',        'Birthday',        'Bright, joyful blooms for another trip around the sun.', 1),
  ('d0000000-0000-4000-8000-000000000002', 'anniversary',     'Anniversary',     'Romantic roses and soft pastels.', 2),
  ('d0000000-0000-4000-8000-000000000003', 'sympathy',        'Sympathy',        'Gentle whites and greens, sent with care.', 3),
  ('d0000000-0000-4000-8000-000000000004', 'congratulations', 'Congratulations', 'Celebrate promotions, graduations and new beginnings.', 4),
  ('d0000000-0000-4000-8000-000000000005', 'get-well',        'Get Well',        'Cheerful, low-scent flowers for recovery.', 5),
  ('d0000000-0000-4000-8000-000000000006', 'just-because',    'Just Because',    'No reason needed.', 6),
  ('d0000000-0000-4000-8000-000000000007', 'mothers-day',     'Mother''s Day',   'For the women who raised us.', 7);

insert into public.tags (id, slug, name) values
  ('e0000000-0000-4000-8000-000000000001', 'roses',      'Roses'),
  ('e0000000-0000-4000-8000-000000000002', 'orchids',    'Orchids'),
  ('e0000000-0000-4000-8000-000000000003', 'sunflowers', 'Sunflowers'),
  ('e0000000-0000-4000-8000-000000000004', 'pastel',     'Pastel'),
  ('e0000000-0000-4000-8000-000000000005', 'low-scent',  'Low scent'),
  ('e0000000-0000-4000-8000-000000000006', 'long-lasting','Long lasting'),
  ('e0000000-0000-4000-8000-000000000007', 'local-grown','Locally grown');

insert into public.add_ons (id, sku, name, description, price_centavos, image_path) values
  ('f0000000-0000-4000-8000-000000000001', 'ADD-CARD',   'Handwritten card',     'Your message written by hand on Floriana stationery.',          5000,  'add-ons/card.jpg'),
  ('f0000000-0000-4000-8000-000000000002', 'ADD-VASE',   'Glass vase',           'Clear cylinder vase so the bouquet is ready to display.',        35000, 'add-ons/vase.jpg'),
  ('f0000000-0000-4000-8000-000000000003', 'ADD-CHOCO',  'Dark chocolate bar',   'Single-origin Davao dark chocolate, 70%.',                        28000, 'add-ons/chocolate.jpg'),
  ('f0000000-0000-4000-8000-000000000004', 'ADD-BALLOON','Mini balloon',         'One 10-inch helium balloon on a ribbon.',                         12000, 'add-ons/balloon.jpg');

-- Products ------------------------------------------------------------------
-- Column order: id, collection, slug, name, short_description, description, care, status, featured, best_seller, position
insert into public.products (id, collection_id, slug, name, short_description, description, care_instructions, status, is_featured, is_best_seller, position, published_at) values
  -- Everyday Blooms
  ('10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'sunday-market-bunch', 'Sunday Market Bunch',
   'A loose, seasonal bunch of whatever is freshest at the Carbon market this week.',
   'Our florists walk the market at dawn and pick what is brightest. Expect a mix of local fillers, chrysanthemums and one hero bloom. No two bunches are the same.',
   'Trim 2 cm off the stems at an angle, use clean room-temperature water and change it every two days. Keep away from direct sun and ripening fruit.',
   'active', true, true, 1, now()),
  ('10000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'cebu-morning', 'Cebu Morning',
   'Sunflowers and yellow chrysanthemums with eucalyptus.',
   'Three sunflowers, yellow mums and silver-dollar eucalyptus wrapped in kraft paper. Sunny on a desk, cheerful on a hospital tray.',
   'Sunflowers drink a lot: top up water daily. Re-cut stems every two days.',
   'active', false, true, 2, now()),
  ('10000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'baby-s-breath-cloud', 'Baby''s Breath Cloud',
   'A full, airy bunch of gypsophila.',
   'Soft white gypsophila on its own, tied with ribbon. Dries beautifully if you hang it upside down.',
   'Keep stems in shallow water. Can be air-dried after a week.',
   'active', false, false, 3, now()),
  ('10000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'tulip-trio', 'Tulip Trio',
   'Nine imported tulips in a single colour.',
   'Nine tulips, your choice of blush, white or yellow, wrapped simply so the stems keep bending toward the light.',
   'Tulips keep growing in the vase. Re-cut stems and keep in a cool spot.',
   'active', false, false, 4, now()),
  -- Premium Bouquets
  ('10000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002', 'blush-romance', 'Blush Romance',
   'Ecuadorian roses in blush and cream with ruscus and wax flower.',
   'A dozen or two dozen premium Ecuadorian roses, hand-tied with Italian ruscus and wax flower, wrapped in ivory and finished with a blush satin ribbon.',
   'Remove guard petals. Re-cut stems under running water and change water daily for the longest vase life.',
   'active', true, true, 10, now()),
  ('10000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', 'ivory-elegance', 'Ivory Elegance',
   'White roses, lisianthus and eucalyptus for a quiet, luxurious bouquet.',
   'Pure whites and soft greens. A favourite for anniversaries, apologies and sympathy.',
   'Lisianthus bruises easily: handle by the stems. Change water every two days.',
   'active', true, false, 11, now()),
  ('10000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000002', 'sage-and-sunset', 'Sage & Sunset',
   'Peach roses, orange ranunculus and dusty miller.',
   'Warm peaches and corals against silvery foliage. Our florists'' pick for birthdays.',
   'Ranunculus are thirsty; keep the water level high.',
   'active', false, false, 12, now()),
  -- Lola's Orchid Collection
  ('10000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000003', 'lolas-phalaenopsis', 'Lola''s Phalaenopsis',
   'A twin-spike white phalaenopsis in a ceramic pot.',
   'The orchid Lola Floriana keeps on her windowsill. Two healthy spikes with buds still to open, potted in a matte ivory ceramic pot with moss.',
   'Water once a week by soaking the roots for 10 minutes, then drain fully. Bright, indirect light. Never let it sit in water.',
   'active', true, true, 20, now()),
  ('10000000-0000-4000-8000-000000000022', 'c0000000-0000-4000-8000-000000000003', 'blush-phalaenopsis', 'Blush Phalaenopsis',
   'Single-spike pink phalaenopsis in a ceramic pot.',
   'A soft pink phalaenopsis chosen for strong roots and a long spike. Blooms last two to three months.',
   'Water weekly by soaking and draining. Bright, indirect light.',
   'active', false, false, 21, now()),
  ('10000000-0000-4000-8000-000000000023', 'c0000000-0000-4000-8000-000000000003', 'dendrobium-garden', 'Dendrobium Garden',
   'Purple dendrobium orchid in a woven basket.',
   'A locally grown dendrobium with multiple canes, planted in a woven abaca basket.',
   'Water twice a week in warm months. Loves morning sun.',
   'active', false, false, 22, now()),
  -- Premium Arrangements
  ('10000000-0000-4000-8000-000000000031', 'c0000000-0000-4000-8000-000000000004', 'sage-garden-arrangement', 'Sage Garden Arrangement',
   'A low, lush table arrangement in a ceramic bowl.',
   'White roses, green hydrangea, eucalyptus and seeded foliage arranged in a sage ceramic bowl. Ready to place on a dining table.',
   'Top up water every two days directly into the foam. Keep cool.',
   'active', true, false, 30, now()),
  ('10000000-0000-4000-8000-000000000032', 'c0000000-0000-4000-8000-000000000004', 'ivory-urn', 'Ivory Urn',
   'A tall sympathy arrangement in white and green.',
   'White lilies, roses and chrysanthemums in a classic urn. Delivered with a printed ribbon on request.',
   'Remove lily pollen anthers as they open to prevent staining.',
   'active', false, false, 31, now()),
  -- One draft product to prove RLS hides it from the public.
  ('10000000-0000-4000-8000-000000000099', 'c0000000-0000-4000-8000-000000000002', 'valentines-preview', 'Valentine''s Preview (Draft)',
   'Not yet released.', 'Internal draft.', null, 'draft', false, false, 99, null);

-- Variants -------------------------------------------------------------------
insert into public.product_variants (id, product_id, sku, name, price_centavos, compare_at_price_centavos, inventory_mode, is_default, position) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'EV-MARKET-STD',  'Standard',        45000, null,  'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'EV-MARKET-LG',   'Generous',        75000, null,  'recipe', false, 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'EV-CEBU-STD',    'Three sunflowers', 65000, null,  'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'EV-CEBU-LG',     'Five sunflowers',  95000, null,  'recipe', false, 2),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'EV-GYP-STD',     'Standard',        39000, null,  'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', 'EV-TULIP-BLUSH', 'Blush',           89000, null,  'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000004', 'EV-TULIP-WHITE', 'White',           89000, null,  'recipe', false, 2),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'EV-TULIP-YELLOW','Yellow',          89000, null,  'recipe', false, 3),

  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000011', 'PB-BLUSH-12',    'A dozen',         249000, 279000, 'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000011', 'PB-BLUSH-24',    'Two dozen',       459000, null,   'recipe', false, 2),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000012', 'PB-IVORY-STD',   'Signature',       395000, null,   'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000012', 'PB-IVORY-GRAND', 'Grand',           595000, null,   'recipe', false, 2),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000013', 'PB-SUNSET-STD',  'Signature',       329000, null,   'recipe', true,  1),

  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000021', 'OR-PHAL-WHITE-2', 'Twin spike, ivory pot', 189000, null, 'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000021', 'OR-PHAL-WHITE-3', 'Triple spike, ivory pot', 269000, null, 'recipe', false, 2),
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000022', 'OR-PHAL-PINK-1',  'Single spike',   129000, null, 'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000023', 'OR-DEND-BASKET',  'Basket',         149000, null, 'recipe', true,  1),

  ('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000031', 'AR-SAGE-STD',    'Standard bowl',   320000, null, 'recipe', true,  1),
  ('20000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000031', 'AR-SAGE-LG',     'Large bowl',      480000, null, 'recipe', false, 2),
  ('20000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000032', 'AR-URN-STD',     'Standard urn',    550000, null, 'recipe', true,  1),

  ('20000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000099', 'PB-VAL-DRAFT',   'Draft',           100000, null, 'untracked', true, 1);

-- Images (paths in the product-images bucket; uploaded separately) ----------
insert into public.product_images (product_id, storage_path, alt_text, position)
select p.id, 'products/' || p.slug || '/01.jpg', p.name || ' — main photo', 1 from public.products p
union all
select p.id, 'products/' || p.slug || '/02.jpg', p.name || ' — detail', 2 from public.products p where p.status = 'active';

-- Occasion tagging ----------------------------------------------------------
insert into public.product_occasions (product_id, occasion_id)
select p.id, o.id from public.products p, public.occasions o
where (p.slug, o.slug) in (
  ('sunday-market-bunch', 'just-because'), ('sunday-market-bunch', 'get-well'),
  ('cebu-morning', 'birthday'), ('cebu-morning', 'get-well'), ('cebu-morning', 'congratulations'),
  ('baby-s-breath-cloud', 'just-because'),
  ('tulip-trio', 'anniversary'), ('tulip-trio', 'mothers-day'),
  ('blush-romance', 'anniversary'), ('blush-romance', 'birthday'), ('blush-romance', 'mothers-day'),
  ('ivory-elegance', 'anniversary'), ('ivory-elegance', 'sympathy'),
  ('sage-and-sunset', 'birthday'), ('sage-and-sunset', 'congratulations'),
  ('lolas-phalaenopsis', 'mothers-day'), ('lolas-phalaenopsis', 'congratulations'), ('lolas-phalaenopsis', 'just-because'),
  ('blush-phalaenopsis', 'mothers-day'), ('blush-phalaenopsis', 'birthday'),
  ('dendrobium-garden', 'congratulations'), ('dendrobium-garden', 'get-well'),
  ('sage-garden-arrangement', 'anniversary'), ('sage-garden-arrangement', 'congratulations'),
  ('ivory-urn', 'sympathy')
);

insert into public.product_tags (product_id, tag_id)
select p.id, t.id from public.products p, public.tags t
where (p.slug, t.slug) in (
  ('cebu-morning', 'sunflowers'), ('cebu-morning', 'local-grown'),
  ('blush-romance', 'roses'), ('blush-romance', 'pastel'),
  ('ivory-elegance', 'roses'), ('ivory-elegance', 'low-scent'),
  ('sage-and-sunset', 'roses'), ('sage-and-sunset', 'pastel'),
  ('lolas-phalaenopsis', 'orchids'), ('lolas-phalaenopsis', 'long-lasting'), ('lolas-phalaenopsis', 'low-scent'),
  ('blush-phalaenopsis', 'orchids'), ('blush-phalaenopsis', 'long-lasting'),
  ('dendrobium-garden', 'orchids'), ('dendrobium-garden', 'local-grown'), ('dendrobium-garden', 'long-lasting'),
  ('baby-s-breath-cloud', 'long-lasting'), ('tulip-trio', 'pastel'),
  ('sage-garden-arrangement', 'roses'), ('ivory-urn', 'low-scent')
);

-- Configured add-ons per product ---------------------------------------------
insert into public.product_add_ons (product_id, add_on_id, max_quantity, position)
select p.id, a.id, case when a.sku = 'ADD-BALLOON' then 3 else 1 end, row_number() over (partition by p.id order by a.sku)
from public.products p, public.add_ons a
where p.status = 'active'
  and (
    a.sku = 'ADD-CARD'
    or (a.sku = 'ADD-VASE' and p.collection_id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002'))
    or (a.sku = 'ADD-CHOCO' and p.collection_id <> 'c0000000-0000-4000-8000-000000000004')
    or (a.sku = 'ADD-BALLOON' and p.slug in ('cebu-morning', 'blush-romance', 'sage-and-sunset'))
  );
