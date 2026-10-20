# Domain modules

Floriana Flowers is a **modular monolith**. Each folder here is a bounded domain that owns
its types, validation schemas, data access and server actions. UI components live in
`src/components` (shared) or `src/modules/<domain>/components` (domain-specific) and must
not contain business rules.

| Module          | Owns                                                  | Status (Phase 1) |
| --------------- | ----------------------------------------------------- | ---------------- |
| `catalog`       | Products, categories, pricing display                 | types + samples  |
| `inventory`     | Stock batches, perishable expiry, atomic reservations | types only       |
| `orders`        | Carts, checkout, order snapshots, status lifecycle    | types only       |
| `delivery`      | Zones, time slots, Asia/Manila scheduling             | types only       |
| `payments`      | Provider abstraction, idempotent processing           | placeholder      |
| `customers`     | Guest contact records, PH privacy consent             | placeholder      |
| `notifications` | Transactional email (Resend or equivalent)            | placeholder      |

Rules of the road:

1. Modules import from `@/lib/*` and sibling modules' **public `index.ts` only**.
2. Money is always integer centavos (`@/lib/money`).
3. Anything that touches the database goes through Supabase with RLS; the service-role
   key is never imported into module code that could be bundled for the client.
