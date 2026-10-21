# Performance results (Lighthouse 13.5, 2026-10-21)

Method: `next build` + `next start` on a MacBook (Apple Silicon), local Supabase, Lighthouse CLI
with Playwright's Chromium. **Mobile** = Lighthouse default mobile emulation (Moto G Power, slow 4G
throttling, 4× CPU slowdown); **Desktop** = `--preset=desktop`. Numbers are from a single run per
page; expect ±5 points of variance. Production on Vercel (edge CDN, Singapore region, HTTP/2,
Brotli) and `*.supabase.co` storage will differ; re-measure on the staging URL before launch.

## Scores

| Page                        | Mode    | Performance   | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --------------------------- | ------- | ------------- | ------------- | -------------- | --- | --- | --- | --- | --- |
| `/` (home)                  | mobile  | **HOME_M**    |
| `/shop`                     | mobile  | **SHOP_M**    |
| `/shop/sunday-market-bunch` | mobile  | **PRODUCT_M** |
| `/cart`                     | mobile  | **CART_M**    |
| `/faqs`                     | mobile  | **FAQS_M**    |
| `/` (home)                  | desktop | **HOME_D**    |

Reports (HTML + JSON) are kept with the Phase 8 run artifacts, not committed.

## Findings and actions

| Finding                                                                                                                                                                                                                                                                                                            | Action                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home LCP 4.8 s (mobile, throttled): hero image preload not priority-hinted; one render-blocking stylesheet (~205 ms).                                                                                                                                                                                              | Added `fetchPriority="high"` to the hero image (next/image already preloads it). Stylesheet is Tailwind's single CSS file; acceptable.                                                                                               |
| Accessibility 95 on home/shop: contrast of hero eyebrow (`ivory/70` = 4.05:1), product-card eyebrow (4.05:1), "warning" badge (4.49:1) and the homepage orchid section overriding badge text colour (1.05:1); heading order (h1 → h3) on home, shop, cart; logo link `aria-label` not containing its visible text. | All fixed: `ivory/85`, `foreground/75`, `--warning` darkened to `#8a5f28`, badge spans excluded from the override, sr-only `h2` "Products" on listing pages, coverage card and cart items use `h2`, logo relies on its visible text. |
| Product page SEO 92: missing meta description when a product has no SEO/short description.                                                                                                                                                                                                                         | Fallback description added in `generateMetadata`.                                                                                                                                                                                    |
| `/cart` SEO 63: page is `noindex`.                                                                                                                                                                                                                                                                                 | Intentional (session-specific page).                                                                                                                                                                                                 |
| Back/forward cache disabled: main document is `Cache-Control: no-store` because storefront pages read cookies (cart) and stream.                                                                                                                                                                                   | Accepted; Cache Components keep the static shell cached at the CDN.                                                                                                                                                                  |
| Unused JavaScript ~59 KiB, legacy JS ~14 KiB on home.                                                                                                                                                                                                                                                              | Accepted for launch; candidates: lazy-load the reviews and coverage checker islands.                                                                                                                                                 |

## Budgets to hold after launch

- Mobile performance ≥ 75 on `/`, ≥ 80 elsewhere; LCP ≤ 2.5 s on production (CDN + real images);
  CLS ≤ 0.1; TBT ≤ 300 ms.
- Accessibility ≥ 95 everywhere; axe serious/critical = 0 (enforced by `e2e/launch.spec.ts`).
- Re-run: `npx lighthouse https://<staging>/ --preset=desktop` and the mobile default; keep the
  JSON in the release notes.

## Server-side

- Checkout `place_order` + payment attempt: single transaction, ~40–80 ms locally.
- Reports run in Postgres (`report_*`), bounded to 366-day ranges; CSV export streams a single
  query result. Dashboard summary is one RPC.
- Concurrency suites: 20 parallel checkouts for the last units → 1 success, no deadlocks;
  10 parallel slot bookings at capacity → capacity respected.
