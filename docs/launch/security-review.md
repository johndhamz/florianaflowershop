# Security review (Phase 8, 2026-10-21)

Scope: application code (`src/`), database schema/policies/functions (`supabase/`), deployment
configuration (`vercel.json`, `next.config.ts`, CI). Method: static review of every privileged
path, privilege probes against the local database as `anon`, `authenticated` (each staff role)
and `service_role`, pgTAP suites 02/05/07/08/09, and the Playwright authorization specs.

Severity: **Critical** = money or customer data exposed to the public; **High** = exposure to a
lower-privileged insider or integrity of payments/stock; **Medium** = defense-in-depth gap;
**Low** = hardening / hygiene.

## Findings

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                    | Status                                                                                                                                                                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **High** | Trusted-path functions (`mark_order_paid`, `mark_payment_failed`, `record_payment_event`, `update_payment_provider_ref`, `claim_due_notifications`, `expire_*`, …) were executable by the `authenticated` role. Their bodies only check "is staff", so a **florist or rider could mark any payment paid** with a fabricated provider id (probe: florist → `PAYMENT_NOT_FOUND`, i.e. the body ran). Anonymous callers were already refused. | **Fixed** in migration 1700: `revoke … from public, anon, authenticated; grant … to service_role` for 15 functions; pgTAP 09 asserts `42501` for anon and staff.                    |
| S2  | Medium   | No HTTP security headers (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`); `X-Powered-By` exposed.                                                                                                                                                                                                                                                                                                                  | **Fixed** in `next.config.ts` (`headers()`); E2E asserts them. CSP keeps `'unsafe-inline'` for scripts because Next.js inlines its bootstrap; a nonce-based policy is a follow-up.  |
| S3  | Medium   | Admin nav linked to `/admin/orders`, `/admin/products`, `/admin/customers`, `/admin/settings` which did not exist (404), so cancellation/refund/product edits had no UI and staff would have used the Supabase dashboard (service role) instead.                                                                                                                                                                                           | **Fixed**: pages added, each behind `requireStaff(permission)` + RLS; nav gated per role.                                                                                           |
| S4  | Medium   | Notification "log" provider printed full customer email addresses; in production without `RESEND_API_KEY` these would land in Vercel logs.                                                                                                                                                                                                                                                                                                 | **Fixed**: addresses masked outside development; the launch checklist requires the key.                                                                                             |
| S5  | Medium   | No data-retention controls: abandoned carts, rendered notification payloads, proof-of-delivery photos/GPS and receiver names were kept forever.                                                                                                                                                                                                                                                                                            | **Fixed**: weekly `run_retention()` job (carts 30 d, notifications 90 d, access tokens 90 d, delivery proofs 180 d); owner/service only; pgTAP covered. Financial records are kept. |
| S6  | Low      | `validate_promo_code` is callable anonymously with any email, so a caller can learn whether an email has a prior paid order when a first-order-only code exists (message differs).                                                                                                                                                                                                                                                         | **Accepted** for launch: PayMongo/Supabase rate limits apply; messages do not confirm account existence otherwise. Follow-up: generic message + per-IP throttle at the edge.        |
| S7  | Low      | Unhandled server errors were only printed by Next; no alerting.                                                                                                                                                                                                                                                                                                                                                                            | **Fixed**: `instrumentation.ts` → `onRequestError` → structured log with secrets/emails redacted + optional `ALERT_WEBHOOK_URL`. `/api/health` added for uptime probes.             |
| S8  | Low      | `console.error("createCheckout failed", err)` could print a gateway error body. The PayMongo adapter only throws `ProviderError(status, message)` without request bodies, and no customer fields are in the message.                                                                                                                                                                                                                       | **Accepted**; messages pass through `redactSensitive` when reported via instrumentation.                                                                                            |
| S9  | Info     | Lighthouse flagged a CSP "inspector issue" on `/shop` and `/cart` with no sub-items; Playwright console capture across `/`, `/shop`, `/cart`, `/checkout` shows **no** CSP violations.                                                                                                                                                                                                                                                     | Monitor after launch (browser console on production).                                                                                                                               |

## What was verified as sound

**Authentication & authorization**

- Staff sessions via Supabase Auth cookies; `proxy.ts` refreshes tokens and redirects anonymous
  `/admin/*` to login (not the authorization boundary). Every admin page and server action calls
  `requireStaff(permission)`; the database re-checks with RLS and `app.assert_staff` inside
  `security definer` functions. Roles come from `staff_profiles` (owner-managed), never from JWT
  metadata; inactive profiles are refused.
- RLS is enabled on all 42 public tables (pgTAP 02). Role matrix verified by probes and E2E:
  florists cannot read customers/payments/addresses; riders see only assigned orders and may
  update only `delivery_status` (trigger `orders_guard_staff_columns`); support cannot assign
  riders or see financial reports; reports and promotions are owner/manager.
- Guest order tracking requires order number **and** a 256-bit token compared by SHA-256 hash;
  tokens are never stored in clear. Cart tokens likewise hashed (`app.cart_token_hash`).

**Secrets**

- `src/lib/env.ts` validates public vs server variables with Zod; server values are read lazily
  and `getServerEnv()` throws in the browser. The service-role key is used only in
  `createAdminClient()` from: checkout payment attempt, payment-proof upload, confirmation-page
  reconciliation, webhook, jobs. No Client Component imports it (verified by grep; `server-only`
  guards the module). `.env.example` has placeholders only; `.env.local` is git-ignored.
- `PAYMENT_PROVIDER=mock` refuses to run in production unless `ALLOW_MOCK_PAYMENTS=true`
  (preview-only). Cron routes require `Authorization: Bearer $CRON_SECRET` (E2E: 401 without it).

**Payments**

- Card data never touches the app: PayMongo hosted checkout; only provider ids/references stored.
- Webhook signature: `Paymongo-Signature` HMAC-SHA256 over `${t}.${rawBody}`; bad signature → 400
  (E2E). Idempotency: `payment_events (provider, provider_event_id)` unique; `payments` and
  `refunds` unique `idempotency_key`; `orders.idempotency_key` unique; replays return the same
  outcome (pgTAP 05, E2E "tolerates duplicates"). Refund totals cannot exceed the payment
  (`app.refunds_check_total`). Prices are immutable snapshots (`app.orders_lock_pricing`).

**Stock & slots**

- FEFO reservations lock batches `FOR UPDATE` in a stable order; two concurrent checkouts for the
  last units: exactly one succeeds (concurrency suite). Slot capacity uses the same pattern.
  Unpaid holds expire by cron and release both.

**Storage**

- `payment-proofs`, `delivery-proofs`, `arrangement-photos` are private buckets; reads use 10-minute
  signed URLs issued only to roles allowed by storage policies; uploads go through server code with
  MIME/size checks. Public buckets allow only images.

**Audit & privacy**

- `app.audit_row` records every write to sensitive tables with PII redaction (emails, phones,
  addresses, tokens) — reviewed in `supabase/migrations/20261020000900_rls.sql`.
- Privacy notice at `/privacy`; checkout requires explicit consent; marketing opt-in separate.
- Error reports strip API keys, JWT-looking strings and emails before logging (unit-tested).

## Residual risks before launch

1. **PayMongo live/sandbox never exercised** (no keys available in this environment). The adapter
   follows the documented API; a staging round-trip is a launch blocker (checklist A).
2. CSP uses `'unsafe-inline'` scripts (Next.js constraint without nonces).
3. No application-level rate limiting on `validate_promo_code` / tracking lookups; relies on
   Supabase/Vercel platform limits. Add Vercel WAF rules or an edge throttle if abuse appears.
