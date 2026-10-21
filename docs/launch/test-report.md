# Test execution report (Phase 8, 2026-10-21)

Everything below was executed on this date against the local stack (Supabase CLI, Next.js 16.4
production build). "Pass" means the command ran and exited 0; counts are copied from tool output.

## 1. Static checks

| Check                     | Command                                     | Result                                                               |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Formatting                | `npx prettier --check .`                    | pass                                                                 |
| Lint                      | `npm run lint`                              | pass (0 errors; 3 known React Compiler warnings for react-hook-form) |
| Type check (strict)       | `npm run typecheck`                         | pass                                                                 |
| Production build          | `npm run build`                             | pass, 50 routes                                                      |
| Schema lint               | `supabase db lint --level warning`          | 0 issues                                                             |
| Migration reproducibility | `supabase db reset` ×2 + `supabase db diff` | "No schema changes found"                                            |
| Generated types in sync   | `npm run db:types`                          | no diff                                                              |

## 2. Automated tests

| Suite                                                    | Scope                                                                                                                                                         | Result                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Unit / component (Vitest + RTL)                          | 25 files                                                                                                                                                      | **88 passed**                                                                            |
| pgTAP (`supabase test db`)                               | 9 suites: foundation, RLS matrix, catalogue, cart, checkout/payments idempotency, inventory ops, dispatch/notifications, reports/promos/CMS, launch hardening | **all pass** (suite 09: 20 assertions incl. retention, least-privilege, price snapshots) |
| Concurrency (`vitest --config vitest.db.config.mts`)     | parallel stock reservations for the last units; parallel slot bookings at capacity                                                                            | **4 passed** — exactly one winner, capacity never exceeded                               |
| Playwright, desktop Chromium + mobile Chromium (Pixel 7) | 7 spec files                                                                                                                                                  | **E2E_RESULT**                                                                           |

### Required E2E flows → where they are covered

| Flow                                                        | Spec                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browse → cart → checkout → payment → delivery               | `launch.spec.ts` "full journey" (plus `dispatch.spec.ts`)                                                                                              |
| Manual payment verification (bank transfer, proof, approve) | `checkout.spec.ts` "bank transfer…"                                                                                                                    |
| Failed payment recovery (retry)                             | `checkout.spec.ts` "failed payment leaves the order payable and retry works"                                                                           |
| Stock-out during checkout                                   | `checkout.spec.ts` "…insufficient stock are rejected"; `storefront.spec.ts` "respects stock limits"; concurrency suite                                 |
| Order cancellation                                          | `launch.spec.ts` "order cancellation releases stock and the slot…"                                                                                     |
| Refund workflow                                             | `launch.spec.ts` "refund workflow…" (gateway refund, tracking, order, reports)                                                                         |
| Florist preparation                                         | `inventory.spec.ts` "florist works the queue…"; `launch.spec.ts` journey                                                                               |
| Rider dispatch                                              | `dispatch.spec.ts`; `launch.spec.ts` journey                                                                                                           |
| Delivery failure                                            | `dispatch.spec.ts` "failed delivery needs a note; retry must be authorized…"                                                                           |
| Admin product updates                                       | `launch.spec.ts` "product updates reach the storefront; archived products disappear"                                                                   |
| Unauthorized access rejection                               | `launch.spec.ts` "role boundaries…", `admin-ops.spec.ts`, `inventory.spec.ts`, `smoke.spec.ts`, `checkout.spec.ts` (tracking token, webhook signature) |
| Mobile + desktop viewports                                  | every spec runs in both Playwright projects; `noHorizontalOverflow` assertions on storefront pages                                                     |
| Keyboard & screen reader                                    | `launch.spec.ts` keyboard test (skip link, focus order, dialog Escape/focus return) and axe WCAG 2.1 AA scan on 10 pages (serious/critical = 0)        |
| Payment webhook idempotency                                 | `checkout.spec.ts` "webhook endpoint rejects bad signatures and tolerates duplicates"; pgTAP 05                                                        |
| Health & security headers                                   | `launch.spec.ts` "health endpoint and security headers"                                                                                                |

## 3. Operational rehearsals

| Rehearsal                 | What was done                                                                                                                                                 | Result                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backup & restore          | `supabase db dump` (schema + data, `--use-copy`) → `supabase db reset --no-seed` (schema rebuilt from migrations only) → `psql -f data.sql` → compare counts  | 13/13 tables and `auth.users` identical (orders 4, payments 4, products 13, audit_logs 81, users 5). Only error: `storage.buckets` duplicate rows (buckets are created by migrations) — documented in runbook R10. |
| Production migration path | Migrations applied from empty database by CI and by the restore rehearsal; `deploy-db.yml` workflow added (dry-run → apply, re-proves on a local stack first) | pass                                                                                                                                                                                                               |
| Retention job             | `run_retention()` executed as service role on fixtures                                                                                                        | carts deleted, notifications redacted, proofs cleared, orders untouched (pgTAP 09)                                                                                                                                 |
| Error alerting            | `instrumentation.ts` → `reportError`; redaction unit-tested                                                                                                   | pass (webhook delivery not exercised: no URL configured)                                                                                                                                                           |
| Lighthouse                | mobile + desktop, 5 pages                                                                                                                                     | see `performance.md`                                                                                                                                                                                               |

## 4. Not executed (and why)

- **PayMongo sandbox/live**: no API keys in this environment. All payment tests use the mock
  gateway behind the same provider interface. Must be done on staging before launch.
- **Resend email delivery**: no key; the log provider was exercised (notification outbox E2E).
- **Vercel/Supabase hosted configuration**: documented and checklisted, cannot be verified locally.
- **SMS**: intentionally disabled.

## 5. Verdict

**VERDICT**
