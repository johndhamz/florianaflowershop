import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Concurrency tests: many parallel sessions race for scarce stock / slot capacity.
 * Requires a running local Supabase (`npx supabase start`).
 */
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55622/postgres";

const TRIPLE_SPIKE_VARIANT = "20000000-0000-4000-8000-000000000022"; // availability 2
const EVENING_SLOT = "80000000-0000-4000-8000-000000000003"; // capacity 6, Mon–Fri

let pool: Pool;
const orderIds: string[] = [];
let slotDate: string;

function nextWeekdayIso(daysAhead = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  pool = new Pool({ connectionString, max: 30 });
  await pool.query("select 1");
  slotDate = nextWeekdayIso();
});

afterAll(async () => {
  for (const id of orderIds) {
    await pool.query(
      "select public.release_stock_reservations('order', $1, 'test cleanup')",
      [id],
    );
    await pool.query("delete from public.stock_reservations where reference_id = $1", [
      id,
    ]);
    await pool.query("delete from public.stock_movements where reference_id = $1", [id]);
  }
  await pool.query(
    "delete from public.delivery_slot_allocations where slot_id = $1 and delivery_date = $2",
    [EVENING_SLOT, slotDate],
  );
  await pool.end();
});

describe("stock reservation under contention", () => {
  it("lets exactly `available` callers win when 20 race for the last units", async () => {
    const { rows } = await pool.query<{ available: number }>(
      "select public.variant_available_quantity($1) as available",
      [TRIPLE_SPIKE_VARIANT],
    );
    const available = rows[0]!.available;
    expect(available).toBeGreaterThan(0);

    const attempts = 20;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, async () => {
        const orderId = randomUUID();
        orderIds.push(orderId);
        const client = await pool.connect();
        try {
          await client.query("begin");
          await client.query(
            "select public.reserve_stock('order', $1, $2, $3::jsonb, now() + interval '10 minutes')",
            [
              orderId,
              `race-${orderId}`,
              JSON.stringify([{ variant_id: TRIPLE_SPIKE_VARIANT, quantity: 1 }]),
            ],
          );
          await client.query("commit");
          return "ok" as const;
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }),
    );

    const wins = results.filter((r) => r.status === "fulfilled").length;
    const losses = results.filter((r) => r.status === "rejected");
    expect(wins).toBe(available);
    expect(losses).toHaveLength(attempts - available);
    for (const loss of losses) {
      expect(String((loss as PromiseRejectedResult).reason)).toMatch(
        /Insufficient stock/,
      );
    }

    const after = await pool.query<{ available: number }>(
      "select public.variant_available_quantity($1) as available",
      [TRIPLE_SPIKE_VARIANT],
    );
    expect(after.rows[0]!.available).toBe(0);

    const reserved = await pool.query<{ total: string }>(
      `select coalesce(sum(quantity), 0)::text as total from public.stock_reservations
       where status = 'active' and material_id = '40000000-0000-4000-8000-000000000020'
         and idempotency_key like 'race-%'`,
    );
    expect(Number(reserved.rows[0]!.total)).toBe(available);
  });
});

describe("delivery slot capacity under contention", () => {
  it("books exactly `capacity` when 20 race for one slot", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        pool.query("select public.reserve_delivery_slot($1, $2::date)", [
          EVENING_SLOT,
          slotDate,
        ]),
      ),
    );
    const wins = results.filter((r) => r.status === "fulfilled").length;
    const losses = results.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];
    expect(wins).toBe(6);
    expect(losses).toHaveLength(14);
    losses.forEach((l) => expect(String(l.reason)).toMatch(/fully booked/));

    const { rows } = await pool.query<{ booked: number; capacity: number }>(
      "select booked, capacity from public.delivery_slot_allocations where slot_id = $1 and delivery_date = $2",
      [EVENING_SLOT, slotDate],
    );
    expect(rows[0]).toMatchObject({ booked: 6, capacity: 6 });
  });
});
