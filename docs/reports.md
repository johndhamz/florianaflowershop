# Reports, dashboard, promotions and CMS (Phase 7)

All figures are computed in Postgres by `security definer` functions in
`supabase/migrations/20261021001600_reports_cms_promotions.sql`. Every report function calls
`app.assert_reports_access()`, which allows **owner** and **manager** only (support, florist and
rider get `FORBIDDEN`). The CSV route and the `/admin/reports` page additionally require the
`reports.read` permission.

## Date boundaries

Reports take two calendar dates (`p_from`, `p_to`, inclusive). `app.manila_range()` converts them to
`[from 00:00, to+1 00:00)` in **Asia/Manila**, so an order paid at 23:30 Manila on the 5th belongs to
the 5th even though it is 15:30 UTC. The UI and the CSV route default to the last 30 days ending on
today's Manila date and cap ranges at 366 days.

## Definitions

Source of truth is the immutable order snapshot (`orders.subtotal_centavos`,
`add_ons_centavos`, `discount_centavos`, `delivery_fee_centavos`, `total_centavos` and
`order_items`), never live product prices.

| Metric                          | Definition                                                                                                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paid orders                     | Orders with `payment_status` in `paid`, `partially_refunded`, `refunded`; dated by `coalesce(confirmed_at, placed_at)` (`app.paid_orders`).                                                                                                  |
| Gross sales                     | Σ(subtotal + add-ons) of paid orders in range. Delivery fees are **not** in gross.                                                                                                                                                           |
| Discounts                       | Σ `discount_centavos` of paid orders in range (promo codes).                                                                                                                                                                                 |
| Refunds                         | Σ `refunds.amount_centavos` where `status = succeeded`, dated by `processed_at`. Partial refunds included.                                                                                                                                   |
| Net sales                       | Gross − discounts − refunds.                                                                                                                                                                                                                 |
| Delivery fees                   | Σ `delivery_fee_centavos` of paid orders, reported separately.                                                                                                                                                                               |
| Collected                       | Σ `total_centavos` of paid orders − refunds (cash actually retained).                                                                                                                                                                        |
| Unpaid orders                   | Orders placed in range with no successful payment. Shown for context, never counted as revenue.                                                                                                                                              |
| Orders by date                  | The same figures grouped by Manila day; a row for every day in range. Daily `net` sums to the summary net.                                                                                                                                   |
| Best sellers                    | Units and revenue per product variant from `order_items` of paid orders (`unit_price × quantity`).                                                                                                                                           |
| Sales by collection             | Best-seller rows aggregated by the product's collection.                                                                                                                                                                                     |
| Payment methods                 | Successful payments grouped by provider and method, with refunded amounts.                                                                                                                                                                   |
| Inventory wastage               | `stock_movements` of type `discard` / `expire` × the batch's `unit_cost_centavos`.                                                                                                                                                           |
| Estimated product cost & margin | Units sold × recipe quantity × the **weighted-average unit cost of batches received in the last 90 days**. Every row carries `is_estimate = true` and the UI labels it "Estimated". Products without a recipe or costed batches show cost 0. |

Reconciliation invariants (covered by `supabase/tests/08_reports_promos_cms.test.sql`):

- `net = gross − discounts − refunds`
- Σ daily net = summary net for the same range
- Unpaid orders never change gross/net
- A partial refund lowers refunds (and net) by exactly its amount and leaves the order in `paid_orders`

## CSV export

`GET /api/admin/reports/{report}.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` with
`report ∈ sales-summary | orders-by-date | best-sellers | sales-by-collection | payment-methods | wastage | product-margin`.
Columns ending in `_centavos` are exported as `_pesos` with two decimals. Cells starting with
`= + - @` are prefixed with `'` to prevent spreadsheet formula injection. Anonymous → 401, other
staff → 403. Samples generated from the seed data live in `docs/samples/`.

## Dashboard

`public.dashboard_summary()` (any staff) returns today's orders, pending payments / proofs,
orders to prepare (and those due today or overdue), today's scheduled deliveries (and unassigned),
failed deliveries, low-stock materials, the latest 20 activity events and the failed-delivery list.
`sales_today_centavos` is **null** for roles without reports access, and the tile is hidden.

## Promotions

`promo_codes` rules enforced by `public.validate_promo_code(code, goods_centavos, email, cart_token)`
and re-checked inside `place_order` (the client result is advisory only):

- active flag, start/end window, `max_uses` (total), `min_subtotal_centavos`, `max_discount_centavos`
- `per_customer_limit` — redemptions by the same email (case-insensitive, `promo_redemptions`)
- `first_order_only` — rejected if the email already has a paid order
- `eligible_collection_ids` — the discount base is only the cart items in those collections; needs the cart
- Codes are matched case-insensitively. Every applied code writes a `promo_redemptions` row and
  bumps `uses_count` atomically inside the order transaction.

Managed at `/admin/promotions` (`promos.manage`: owner, manager), which also shows redemptions and
total discount given per code.

## Content management

`/admin/content` (`content.manage`: owner, manager) edits the JSON of each `site_content` block
(homepage hero and story, Our Story, delivery information, FAQs, contact, SEO defaults). Drafts are
validated against the Zod schemas in `src/modules/cms/schemas.ts`; **Publish** copies the draft into
`published_data`, sets `published_at` and revalidates the `content` cache tag. The storefront reads
`published_data` only, so unpublished drafts never leak. The same page edits collection name,
tagline, description, SEO title/description, position and visibility (featured collections).
Site-wide `<title>`/description come from the `seo` block when published, else `siteConfig`.
