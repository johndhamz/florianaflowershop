# Production launch checklist

Tick every box before DNS points at Vercel. Owner signs the last section.

## A. Code & tests (engineering)

- [x] `main` green in CI: format, lint, typecheck, unit (88), build, migrations ×2 from scratch, schema lint, pgTAP (9 suites), concurrency suites, Playwright desktop + mobile.
- [x] Required E2E flows automated (see `docs/launch/test-report.md`): browse→cart→checkout→payment→delivery, manual payment verification, failed-payment recovery, stock-out at checkout, order cancellation, refund, florist preparation, rider dispatch, delivery failure, admin product updates, unauthorized access.
- [x] Accessibility: axe (WCAG 2.1 AA, serious/critical = 0) on storefront and admin pages; keyboard skip-link, focus order and dialog escape tested.
- [x] Security headers (CSP, HSTS, nosniff, frame-ancestors none, referrer policy) verified by E2E.
- [x] Lighthouse mobile ≥ 75 performance, ≥ 95 accessibility, 100 SEO on storefront pages (`docs/launch/performance.md`).
- [ ] **PayMongo sandbox round-trip on staging** (checkout, webhook, refund) — blocked until keys exist. _Launch blocker._

## B. Supabase (production project)

- [ ] Project in `ap-southeast-1`, Pro plan, **PITR enabled**, daily backups confirmed in dashboard.
- [ ] Migrations applied via **Deploy database** workflow; `supabase migration list --linked` shows every file in `supabase/migrations/`.
- [ ] Email sign-ups **disabled**; staff created by invite; dev seed accounts (`*@floriana.local`) **absent**.
- [ ] Site URL / redirect URLs set to the production domain.
- [ ] `business_settings` row 1 filled with real contact details, bank instructions, `online_payments_enabled=true`.
- [ ] Delivery zones, slots, promo codes reviewed (`/admin/delivery-settings`, `/admin/promotions`).
- [ ] Catalogue: real products, prices, images in `product-images`; recipes and opening stock received (`/admin/inventory/receive`).
- [ ] Content blocks published (`/admin/content`): hero, story, FAQs, delivery info, contact, SEO.
- [ ] Row Level Security enabled on every table (CI pgTAP suite 02 asserts this; re-check in dashboard → Database → Policies).

## C. Vercel

- [ ] All variables from `docs/launch/deployment.md` §1 set for **Production**; `ALLOW_MOCK_PAYMENTS` **unset**; `PAYMENT_PROVIDER=paymongo`.
- [ ] `CRON_SECRET` set and the three crons visible under Settings → Cron Jobs.
- [ ] Custom domain + HTTPS active; `www` → apex redirect.
- [ ] Deployment protection on previews; production deploys only from `main`.
- [ ] `ALERT_WEBHOOK_URL` set; a test error (`throw` on a preview) reached the channel.

## D. PayMongo

- [ ] Live keys in Vercel; webhook created for the production URL; `PAYMONGO_WEBHOOK_SECRET` set.
- [ ] One real ₱20 payment confirmed via webhook, then refunded from `/admin/payments`.
- [ ] Settlement bank account verified in the PayMongo dashboard.

## E. Monitoring & operations

- [ ] Uptime monitor on `GET /api/health` (1-minute interval, alert after 2 failures).
- [ ] Vercel log drain or notifications enabled; Supabase usage alerts (DB size, connections).
- [ ] Runbooks read by the owner and manager (`docs/launch/runbooks.md`); launch-day watch rota agreed.
- [ ] Backup/restore rehearsal repeated against the production project's first backup (R10).

## F. Privacy & legal (Philippines)

- [ ] Privacy notice reviewed by the owner; checkout consent checkbox text matches it.
- [ ] Retention job enabled (weekly cron) and the windows accepted (carts 30 d, notifications 90 d, delivery proofs 180 d).
- [ ] Data Protection Officer / contact named in the privacy notice; NPC registration assessed.
- [ ] Official receipts / BIR invoicing process agreed (outside this system).

## G. Go / no-go

- [ ] No open **Critical** or **High** items in `docs/launch/defects.md`.
- [ ] Owner sign-off: ______________________ Date: __________
