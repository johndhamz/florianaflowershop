-- ============================================================================
-- Seed 03 · Suppliers, materials, stock batches, bouquet recipes
-- ============================================================================

insert into public.suppliers (id, name, contact_name, phone, email, address) values
  ('30000000-0000-4000-8000-000000000001', 'Carbon Market Growers Co-op', 'Aling Nena',  '+639181110001', 'nena@carbongrowers.local', 'Carbon Market, Cebu City'),
  ('30000000-0000-4000-8000-000000000002', 'Benguet Highland Flowers',   'Mang Rudy',   '+639181110002', 'orders@benguetflowers.local', 'La Trinidad, Benguet'),
  ('30000000-0000-4000-8000-000000000003', 'Bloomline Imports',          'Kris Lim',    '+639181110003', 'kris@bloomline.local', 'Mandaue City');

-- Materials (sku, name, category, unit, perishable, shelf_life_days, low_stock_threshold, default_supplier)
insert into public.materials (id, sku, name, category, unit, is_perishable, default_shelf_life_days, low_stock_threshold, default_supplier_id) values
  ('40000000-0000-4000-8000-000000000001', 'FL-ROSE-ECU-BLUSH', 'Ecuadorian rose, blush',      'flower',  'stem',  true, 7, 24, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000002', 'FL-ROSE-ECU-WHITE', 'Ecuadorian rose, white',      'flower',  'stem',  true, 7, 24, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000003', 'FL-ROSE-ECU-PEACH', 'Ecuadorian rose, peach',      'flower',  'stem',  true, 7, 12, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000004', 'FL-SUNFLOWER',      'Sunflower',                   'flower',  'stem',  true, 6, 15, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000005', 'FL-MUM-YELLOW',     'Chrysanthemum, yellow',       'flower',  'stem',  true, 10, 20, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000006', 'FL-MUM-WHITE',      'Chrysanthemum, white',        'flower',  'stem',  true, 10, 20, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000007', 'FL-GYPSO',          'Gypsophila (baby''s breath)',  'flower',  'bunch', true, 8, 6,  '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000008', 'FL-TULIP-BLUSH',    'Tulip, blush',                'flower',  'stem',  true, 5, 18, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000009', 'FL-TULIP-WHITE',    'Tulip, white',                'flower',  'stem',  true, 5, 18, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000010', 'FL-TULIP-YELLOW',   'Tulip, yellow',               'flower',  'stem',  true, 5, 18, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000011', 'FL-LISIANTHUS-WH',  'Lisianthus, white',           'flower',  'stem',  true, 7, 10, '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000012', 'FL-RANUNCULUS-OR',  'Ranunculus, orange',          'flower',  'stem',  true, 5, 10, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000013', 'FL-HYDRANGEA-GR',   'Hydrangea, green',            'flower',  'stem',  true, 6, 6,  '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000014', 'FL-LILY-WHITE',     'Oriental lily, white',        'flower',  'stem',  true, 8, 10, '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000015', 'FO-EUCALYPTUS',     'Eucalyptus, silver dollar',   'foliage', 'bunch', true, 12, 5, '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000016', 'FO-RUSCUS',         'Italian ruscus',              'foliage', 'bunch', true, 14, 5, '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000017', 'FO-WAXFLOWER',      'Wax flower',                  'foliage', 'bunch', true, 10, 5, '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000018', 'FO-DUSTY-MILLER',   'Dusty miller',                'foliage', 'bunch', true, 10, 4, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000019', 'PL-PHAL-WHITE-2S',  'Phalaenopsis, white, 2 spikes','plant',  'piece', true, 30, 3, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000020', 'PL-PHAL-WHITE-3S',  'Phalaenopsis, white, 3 spikes','plant',  'piece', true, 30, 2, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000021', 'PL-PHAL-PINK-1S',   'Phalaenopsis, pink, 1 spike', 'plant',   'piece', true, 30, 3, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000022', 'PL-DENDROBIUM',     'Dendrobium, purple',          'plant',   'piece', true, 45, 2, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000023', 'CT-POT-IVORY',      'Ceramic pot, matte ivory',    'container','piece', false, null, 4, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000024', 'CT-BASKET-ABACA',   'Abaca basket',                'container','piece', false, null, 3, '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000025', 'CT-BOWL-SAGE',      'Ceramic bowl, sage',          'container','piece', false, null, 3, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000026', 'CT-URN-WHITE',      'Urn, white',                  'container','piece', false, null, 2, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000027', 'WR-PAPER-IVORY',    'Wrapping paper, ivory',       'wrap',    'piece', false, null, 20, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000028', 'WR-PAPER-KRAFT',    'Wrapping paper, kraft',       'wrap',    'piece', false, null, 20, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000029', 'WR-RIBBON-BLUSH',   'Satin ribbon, blush',         'wrap',    'metre', false, null, 10, '30000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000030', 'CS-FOAM-BLOCK',     'Floral foam block',           'consumable','piece', false, null, 6, '30000000-0000-4000-8000-000000000003');

-- Stock batches: received over the last few days; perishables expire by shelf life.
insert into public.stock_batches (id, material_id, supplier_id, batch_code, quantity_received, quantity_remaining, unit_cost_centavos, received_at, expires_at, created_by)
select
  ('50000000-0000-4000-8000-' || lpad(b.n::text, 12, '0'))::uuid,
  m.id, m.default_supplier_id, b.code, b.qty, b.qty, b.cost,
  now() - (b.age_days || ' days')::interval,
  case when m.is_perishable then now() - (b.age_days || ' days')::interval + (m.default_shelf_life_days || ' days')::interval end,
  'a0000000-0000-4000-8000-000000000003'
from (values
  (1,  'FL-ROSE-ECU-BLUSH', 'B-ROSE-BL-1018', 120, 1, 4500),
  (2,  'FL-ROSE-ECU-BLUSH', 'B-ROSE-BL-1020', 100, 0, 4500),
  (3,  'FL-ROSE-ECU-WHITE', 'B-ROSE-WH-1019',  96, 1, 4500),
  (4,  'FL-ROSE-ECU-PEACH', 'B-ROSE-PC-1019',  36, 1, 4800),
  (5,  'FL-SUNFLOWER',      'B-SUN-1020',       45, 0, 2500),
  (6,  'FL-MUM-YELLOW',     'B-MUMY-1019',      60, 1, 1200),
  (7,  'FL-MUM-WHITE',      'B-MUMW-1019',      60, 1, 1200),
  (8,  'FL-GYPSO',          'B-GYP-1018',       14, 2, 9000),
  (9,  'FL-TULIP-BLUSH',    'B-TUL-BL-1020',    54, 0, 3800),
  (10, 'FL-TULIP-WHITE',    'B-TUL-WH-1020',    27, 0, 3800),
  (11, 'FL-TULIP-YELLOW',   'B-TUL-YE-1020',    18, 0, 3800),
  (12, 'FL-LISIANTHUS-WH',  'B-LIS-1019',       30, 1, 5200),
  (13, 'FL-RANUNCULUS-OR',  'B-RAN-1020',       24, 0, 6000),
  (14, 'FL-HYDRANGEA-GR',   'B-HYD-1019',       12, 1, 15000),
  (15, 'FL-LILY-WHITE',     'B-LILY-1019',      20, 1, 9000),
  (16, 'FO-EUCALYPTUS',     'B-EUC-1016',       12, 4, 18000),
  (17, 'FO-RUSCUS',         'B-RUS-1016',       10, 4, 15000),
  (18, 'FO-WAXFLOWER',      'B-WAX-1018',        8, 2, 16000),
  (19, 'FO-DUSTY-MILLER',   'B-DUST-1018',       6, 2, 12000),
  (20, 'PL-PHAL-WHITE-2S',  'B-PHAL2-1010',      6, 10, 90000),
  (21, 'PL-PHAL-WHITE-3S',  'B-PHAL3-1010',      2, 10, 140000),
  (22, 'PL-PHAL-PINK-1S',   'B-PHALP-1010',      5, 10, 60000),
  (23, 'PL-DENDROBIUM',     'B-DEND-1005',       4, 15, 70000),
  (24, 'CT-POT-IVORY',      'B-POT-0901',       20, 49, 25000),
  (25, 'CT-BASKET-ABACA',   'B-BASK-0901',      10, 49, 18000),
  (26, 'CT-BOWL-SAGE',      'B-BOWL-0901',       8, 49, 42000),
  (27, 'CT-URN-WHITE',      'B-URN-0901',        4, 49, 65000),
  (28, 'WR-PAPER-IVORY',    'B-PAPI-0901',     200, 49, 1500),
  (29, 'WR-PAPER-KRAFT',    'B-PAPK-0901',     200, 49, 900),
  (30, 'WR-RIBBON-BLUSH',   'B-RIB-0901',      100, 49, 1200),
  (31, 'CS-FOAM-BLOCK',     'B-FOAM-0901',      24, 49, 6500),
  -- An already-expired batch to exercise the expiry job (received 12 days ago, 7-day life).
  (32, 'FL-ROSE-ECU-BLUSH', 'B-ROSE-BL-1008',   30, 12, 4500)
) as b(n, sku, code, qty, age_days, cost)
join public.materials m on m.sku = b.sku;

insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reason, created_by)
select id, material_id, 'receive', quantity_received, 'Seed receipt', created_by from public.stock_batches;

-- Recipes: bill of materials per variant --------------------------------------
insert into public.bouquet_recipes (id, variant_id, name, assembly_minutes)
select ('60000000-0000-4000-8000-' || lpad(row_number() over (order by v.sku)::text, 12, '0'))::uuid, v.id, p.name || ' · ' || v.name,
  case when p.collection_id = 'c0000000-0000-4000-8000-000000000004' then 35
       when p.collection_id = 'c0000000-0000-4000-8000-000000000002' then 25
       when p.collection_id = 'c0000000-0000-4000-8000-000000000003' then 10
       else 12 end
from public.product_variants v
join public.products p on p.id = v.product_id
where v.inventory_mode = 'recipe';

insert into public.recipe_items (recipe_id, material_id, quantity, is_optional)
select r.id, m.id, x.qty, x.optional
from (values
  -- Everyday
  ('EV-MARKET-STD',  'FL-MUM-YELLOW', 5, false), ('EV-MARKET-STD', 'FL-MUM-WHITE', 4, false), ('EV-MARKET-STD', 'FL-GYPSO', 0.5, false), ('EV-MARKET-STD', 'WR-PAPER-KRAFT', 1, false),
  ('EV-MARKET-LG',   'FL-MUM-YELLOW', 8, false), ('EV-MARKET-LG',  'FL-MUM-WHITE', 8, false), ('EV-MARKET-LG',  'FL-GYPSO', 1, false),   ('EV-MARKET-LG',  'WR-PAPER-KRAFT', 2, false),
  ('EV-CEBU-STD',    'FL-SUNFLOWER', 3, false),  ('EV-CEBU-STD',   'FL-MUM-YELLOW', 4, false), ('EV-CEBU-STD', 'FO-EUCALYPTUS', 0.25, false), ('EV-CEBU-STD', 'WR-PAPER-KRAFT', 1, false),
  ('EV-CEBU-LG',     'FL-SUNFLOWER', 5, false),  ('EV-CEBU-LG',    'FL-MUM-YELLOW', 6, false), ('EV-CEBU-LG',  'FO-EUCALYPTUS', 0.5, false),  ('EV-CEBU-LG',  'WR-PAPER-KRAFT', 1, false),
  ('EV-GYP-STD',     'FL-GYPSO', 2, false),      ('EV-GYP-STD',    'WR-RIBBON-BLUSH', 1, false),
  ('EV-TULIP-BLUSH', 'FL-TULIP-BLUSH', 9, false),  ('EV-TULIP-BLUSH', 'WR-PAPER-IVORY', 1, false),
  ('EV-TULIP-WHITE', 'FL-TULIP-WHITE', 9, false),  ('EV-TULIP-WHITE', 'WR-PAPER-IVORY', 1, false),
  ('EV-TULIP-YELLOW','FL-TULIP-YELLOW', 9, false), ('EV-TULIP-YELLOW','WR-PAPER-IVORY', 1, false),
  -- Premium bouquets
  ('PB-BLUSH-12',  'FL-ROSE-ECU-BLUSH', 12, false), ('PB-BLUSH-12', 'FO-RUSCUS', 0.5, false), ('PB-BLUSH-12', 'FO-WAXFLOWER', 0.5, false), ('PB-BLUSH-12', 'WR-PAPER-IVORY', 2, false), ('PB-BLUSH-12', 'WR-RIBBON-BLUSH', 1.5, false),
  ('PB-BLUSH-24',  'FL-ROSE-ECU-BLUSH', 24, false), ('PB-BLUSH-24', 'FO-RUSCUS', 1, false),   ('PB-BLUSH-24', 'FO-WAXFLOWER', 1, false),   ('PB-BLUSH-24', 'WR-PAPER-IVORY', 3, false), ('PB-BLUSH-24', 'WR-RIBBON-BLUSH', 2, false),
  ('PB-IVORY-STD', 'FL-ROSE-ECU-WHITE', 12, false), ('PB-IVORY-STD', 'FL-LISIANTHUS-WH', 6, false), ('PB-IVORY-STD', 'FO-EUCALYPTUS', 0.5, false), ('PB-IVORY-STD', 'WR-PAPER-IVORY', 2, false), ('PB-IVORY-STD', 'WR-RIBBON-BLUSH', 1.5, false),
  ('PB-IVORY-GRAND','FL-ROSE-ECU-WHITE', 24, false), ('PB-IVORY-GRAND', 'FL-LISIANTHUS-WH', 10, false), ('PB-IVORY-GRAND', 'FO-EUCALYPTUS', 1, false), ('PB-IVORY-GRAND', 'WR-PAPER-IVORY', 3, false), ('PB-IVORY-GRAND', 'WR-RIBBON-BLUSH', 2, false),
  ('PB-SUNSET-STD','FL-ROSE-ECU-PEACH', 10, false), ('PB-SUNSET-STD', 'FL-RANUNCULUS-OR', 8, false), ('PB-SUNSET-STD', 'FO-DUSTY-MILLER', 0.5, false), ('PB-SUNSET-STD', 'WR-PAPER-IVORY', 2, false), ('PB-SUNSET-STD', 'WR-RIBBON-BLUSH', 1.5, false),
  -- Orchids
  ('OR-PHAL-WHITE-2', 'PL-PHAL-WHITE-2S', 1, false), ('OR-PHAL-WHITE-2', 'CT-POT-IVORY', 1, false),
  ('OR-PHAL-WHITE-3', 'PL-PHAL-WHITE-3S', 1, false), ('OR-PHAL-WHITE-3', 'CT-POT-IVORY', 1, false),
  ('OR-PHAL-PINK-1',  'PL-PHAL-PINK-1S', 1, false),  ('OR-PHAL-PINK-1',  'CT-POT-IVORY', 1, false),
  ('OR-DEND-BASKET',  'PL-DENDROBIUM', 1, false),    ('OR-DEND-BASKET',  'CT-BASKET-ABACA', 1, false),
  -- Arrangements
  ('AR-SAGE-STD', 'FL-ROSE-ECU-WHITE', 8, false), ('AR-SAGE-STD', 'FL-HYDRANGEA-GR', 2, false), ('AR-SAGE-STD', 'FO-EUCALYPTUS', 0.5, false), ('AR-SAGE-STD', 'CT-BOWL-SAGE', 1, false), ('AR-SAGE-STD', 'CS-FOAM-BLOCK', 1, false),
  ('AR-SAGE-LG',  'FL-ROSE-ECU-WHITE', 14, false), ('AR-SAGE-LG', 'FL-HYDRANGEA-GR', 4, false), ('AR-SAGE-LG', 'FO-EUCALYPTUS', 1, false),   ('AR-SAGE-LG', 'CT-BOWL-SAGE', 1, false), ('AR-SAGE-LG', 'CS-FOAM-BLOCK', 2, false),
  ('AR-URN-STD',  'FL-LILY-WHITE', 6, false), ('AR-URN-STD', 'FL-ROSE-ECU-WHITE', 10, false), ('AR-URN-STD', 'FL-MUM-WHITE', 10, false), ('AR-URN-STD', 'FO-RUSCUS', 1, false), ('AR-URN-STD', 'CT-URN-WHITE', 1, false), ('AR-URN-STD', 'CS-FOAM-BLOCK', 2, false)
) as x(variant_sku, material_sku, qty, optional)
join public.product_variants v on v.sku = x.variant_sku
join public.bouquet_recipes r on r.variant_id = v.id
join public.materials m on m.sku = x.material_sku;
