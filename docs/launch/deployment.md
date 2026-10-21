# Deployment & rollback

Floriana Flowers deploys as **one Vercel project** (Next.js app) plus **one Supabase project** per
environment (staging, production). The app only ever talks to the database through the anon key
(RLS) or, on trusted server paths, the service-role key. Secrets live in Vercel environment
variables and GitHub environment secrets; nothing secret is committed.

## 1. One-time environment setup

### Supabase project

1. Create the project (region: Singapore `ap-southeast-1` for Cebu latency). Note the project ref,
   anon key, service-role key and database password.
2. **Auth → URL configuration**: Site URL `https://<domain>`, redirect URLs
   `https://<domain>/admin/**`. Disable public sign-ups (`Auth → Providers → Email → Enable sign-ups:
off`); staff accounts are created by the owner (see runbooks).
3. **Auth → Rate limits**: keep defaults (sign-in attempts, token refresh). Minimum password
   length 10 (matches `supabase/config.toml`).
4. **Database → Backups**: Pro plan daily backups are automatic; enable **PITR** for production
   (7 days). See `docs/launch/runbooks.md` for the restore rehearsal.
5. **Storage**: buckets are created by migrations (`product-images`, `content-media` public;
   `payment-proofs`, `delivery-proofs`, `arrangement-photos` private).
6. Apply migrations with the **Deploy database** GitHub workflow (`dry-run` then `apply`), or
   locally: `npx supabase link --project-ref <ref> && npx supabase db push`.
7. Seed only what production needs: run `supabase/seeds/01_staff.sql` **after replacing the
   passwords and emails**, plus `04_delivery_settings.sql` and the product catalogue. Never load
   `05_orders.sql` or the dev staff logins into production.
8. Upload real product and content images to the public buckets; paths are referenced from
   `product_images.path` and `site_content.*.image_path`.

### PayMongo

1. Live keys from the PayMongo dashboard (`sk_live_…`, `pk_live_…`).
2. Create a webhook for `https://<domain>/api/webhooks/paymongo` with events
   `checkout_session.payment.paid`, `payment.paid`, `payment.failed`, `payment.refunded`,
   `payment.refund.updated`. Store the returned `secret_key` as `PAYMONGO_WEBHOOK_SECRET`.
3. **Before launch**, run the sandbox checklist in `docs/payments.md` with test keys on staging.
   The automated suites use the mock gateway only; a real PayMongo round-trip has not been
   exercised by CI.

### Vercel project

Environment variables (Production and Preview separately):

| Variable                                      | Production value                    | Notes                                                 |
| --------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                        | `https://<domain>`                  | Used for canonical URLs, payment return URLs, emails  |
| `NEXT_PUBLIC_SUPABASE_URL`                    | `https://<ref>.supabase.co`         |                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`               | anon key                            | Safe to expose; RLS protects data                     |
| `SUPABASE_SERVICE_ROLE_KEY`                   | service-role key                    | **Server only.** Checkout, webhooks, jobs             |
| `PAYMENT_PROVIDER`                            | `paymongo`                          | `mock` refuses to run in production                   |
| `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` | live keys                           |                                                       |
| `PAYMONGO_WEBHOOK_SECRET`                     | from webhook creation               |                                                       |
| `ALLOW_MOCK_PAYMENTS`                         | _(unset)_                           | Only ever `true` on a preview that must demo payments |
| `CRON_SECRET`                                 | 32+ random chars                    | Vercel Cron sends it as `Authorization: Bearer`       |
| `RESEND_API_KEY`                              | `re_…`                              | Without it, emails are only logged (redacted)         |
| `ALERT_WEBHOOK_URL`                           | Slack/Discord/PagerDuty inbound URL | Optional; unhandled server errors post here           |

Vercel settings: Framework **Next.js**, Node **24**, Region pinned in `vercel.json` to the
Supabase project's region (`syd1` for the current `ap-southeast-2` project). Crons come from
`vercel.json`. **Production needs the Vercel Pro plan**: the Hobby plan rejects any cron that runs
more than once a day, so the committed schedules are the Hobby-compatible daily ones (reservation
expiry 00:00 Manila, notifications 00:05 Manila, retention weekly). Before launch, on Pro, set
`/api/jobs/expire-reservations` to `*/5 * * * *` and `/api/jobs/notifications` to `* * * * *`;
until then abandoned checkouts hold stock and delivery slots for up to a day and emails go out once
a day. Protect the `main` branch; production deploys only from `main`.

## 2. Release procedure (every deploy)

1. **CI green on `main`** (`.github/workflows/ci.yml`): format, lint, typecheck, unit, build,
   migrations from scratch twice, pgTAP, concurrency suites, Playwright.
2. **Database first, app second.** Migrations are additive-only (new tables/columns/functions,
   never dropping columns the running app reads). Run **Deploy database → dry-run**, read the
   list, then **apply**. The workflow re-proves the migrations on a fresh local stack before
   touching the project.
3. Push/merge to `main` → Vercel builds and deploys. Watch the build log; a failed env validation
   (`EnvValidationError`) fails the build loudly.
4. **Smoke** (2 minutes): `GET /api/health` → `{"status":"ok","database":"ok"}`; open `/`,
   `/shop`, a product page, `/admin/login` (sign in as a real manager), `/admin` dashboard.
   On the first production deploy also run one real ₱20 PayMongo payment and refund it.
5. Announce in the team channel with the Vercel deployment URL and the migration list.

## 3. Rollback

### App (seconds)

Vercel → Deployments → previous good deployment → **Promote to Production** (or
`vercel rollback`). Because migrations are additive and every DB function keeps its previous
signature within a release, the previous app version keeps working against the newer schema.

### Database

Prefer _roll forward_: write a new migration that reverts the change (e.g. `drop function …`,
`alter table … drop column …`) and deploy it through the same workflow. Only for data corruption
use **PITR** (Supabase dashboard → Database → Backups → Point in time) to the minute before the
incident, then re-run the app smoke test. PITR replaces the whole database: notify the team,
pause Vercel crons (set `CRON_SECRET` to a throwaway value) during the restore, and reconcile any
orders placed in the gap from PayMongo's dashboard afterwards.

### Payments

Never roll back while a payment is in flight. Webhooks that arrive during a rollback are retried
by PayMongo for up to 12 attempts; `payment_events` records each one once, so replays are safe.

## 4. Preview environments

Pull-request previews deploy with the **Preview** env vars pointing at **staging** Supabase with
`PAYMENT_PROVIDER=mock` and `ALLOW_MOCK_PAYMENTS=true`. Never point a preview at production data.
