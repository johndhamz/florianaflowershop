# Floriana Flowers

> Love, in every bloom. — A delivery-first flower shop in Cebu, Philippines.

Named after Lola Floriana, 86, who still cares for her orchids. The shop pairs affordable
everyday flowers with premium bouquets, orchid gifts and elegant arrangements.

## Stack

| Layer      | Choice                                                  |
| ---------- | ------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Cache Components, Turbopack)    |
| Language   | TypeScript (strict)                                     |
| Styling    | Tailwind CSS v4 + shadcn/ui (Radix, Nova preset)        |
| Data       | Supabase (Postgres, Auth, Storage) with RLS             |
| Validation | Zod + React Hook Form                                   |
| Tests      | Vitest + React Testing Library (unit), Playwright (E2E) |
| Deploy     | Vercel                                                  |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase values (placeholders work for Phase 1)
npm run dev                  # http://localhost:3000
```

Routes available after Phase 1:

- `/` – storefront homepage shell
- `/admin` – admin dashboard shell
- any unknown URL – branded 404

## Scripts

| Script              | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the dev server                                 |
| `npm run build`     | Production build (also runs TypeScript)              |
| `npm run start`     | Serve the production build                           |
| `npm run lint`      | ESLint (Next core-web-vitals + TS + Prettier compat) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit`                      |
| `npm run format`    | Prettier (with Tailwind class sorting)               |
| `npm run test`      | Vitest unit/component tests                          |
| `npm run test:e2e`  | Playwright smoke tests (desktop + mobile Chromium)   |
| `npm run check`     | lint → typecheck → test → build                      |

First E2E run: `npx playwright install chromium`. If port 3000 is busy, run
`PORT=3100 npm run test:e2e`. Screenshots land in `e2e/screenshots/` (git-ignored).

## Project structure

```
src/
├─ app/                    # Routes only. No business logic here.
│  ├─ (storefront)/        # Customer-facing pages (header + footer layout)
│  ├─ admin/               # Back office (sidebar + topbar layout, noindex)
│  ├─ error.tsx            # Segment error boundary (uses `retry`)
│  ├─ global-error.tsx     # Root-layout error boundary
│  └─ not-found.tsx        # Branded 404
├─ components/
│  ├─ ui/                  # shadcn/ui primitives (generated, lightly themed)
│  ├─ shared/              # Product card, status badge, data table, empty state, skeletons…
│  ├─ layout/              # Headers, footers, navs, skip link
│  ├─ brand/               # Logo, social glyphs
│  └─ providers/           # Tooltip + toast providers
├─ config/                 # Static site + navigation config (no secrets)
├─ lib/                    # Cross-cutting utilities: env, money, datetime, supabase
├─ modules/                # Bounded domains (catalog, orders, inventory, delivery, …)
├─ proxy.ts                # Supabase session refresh for /admin/*
└─ test/                   # Vitest setup
```

See `src/modules/README.md` for the domain boundaries and the rules each module follows.

## Design system

Tokens live in `src/app/globals.css` and map the brand palette onto shadcn's semantic
variables:

| Token | Hex       | Used for                                 |
| ----- | --------- | ---------------------------------------- |
| Ivory | `#F7F0E7` | Page background                          |
| Blush | `#E8C9CF` | Secondary surfaces, merchandising badges |
| Sage  | `#77866B` | Accents, focus rings, success            |
| Cocoa | `#614438` | Primary actions, headings                |

Headings use Cormorant Garamond (serif); interface text uses Inter. Motion is limited to a
single `animate-fade-up` and hover transitions, and respects `prefers-reduced-motion`.

## Environment variables

| Variable                        | Scope  | Notes                                           |
| ------------------------------- | ------ | ----------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | public | Canonical URL for metadata                      |
| `NEXT_PUBLIC_SUPABASE_URL`      | public | Supabase project URL                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key; all access is RLS-enforced            |
| `SUPABASE_SERVICE_ROLE_KEY`     | server | Never exposed; unused until trusted server jobs |

Validation is in `src/lib/env.ts`. Public vars are validated lazily when a Supabase client
is created; the storefront homepage needs none of them.

## Conventions

- Money is integer centavos everywhere; format only at the edge with `formatCentavos`.
- Dates render in `Asia/Manila` via `formatManila`.
- Any component reading `cookies()`/`headers()` must sit behind `<Suspense>` (Cache
  Components). Never read the session at a layout's top level.
- Error boundaries receive `{ error: unknown, retry }` (Next 16), not `reset`.
- Routes under `/shop`, `/delivery`, etc. are linked from navigation but ship in later
  phases.

## CI

`.github/workflows/ci.yml` runs format check, lint, typecheck, unit tests and build, then
Playwright E2E against the production build.
