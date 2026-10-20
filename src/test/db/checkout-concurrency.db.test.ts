import { randomBytes, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Concurrent last-item purchases and slot races through the real place_order path. */
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55622/postgres";
const TRIPLE_SPIKE = "20000000-0000-4000-8000-000000000022"; // availability 2
const ZONE = "70000000-0000-4000-8000-000000000001";
const EVENING_SLOT = "80000000-0000-4000-8000-000000000003"; // capacity 6

let pool: Pool;
let date: string;
const createdOrders: string[] = [];

function nextWeekday(daysAhead: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function input(slot: string) {
  return {
    sender: {
      name: "Race Buyer",
      email: `race-${randomUUID().slice(0, 8)}@example.com`,
      phone: "+639171230000",
    },
    recipient: {
      name: "Rina",
      phone: "+639181230000",
      address_line1: "12 Juana Osmena St",
      barangay: "Lahug",
    },
    delivery: { zone_id: ZONE, date, slot_id: slot },
    payment_method: "bank_transfer",
    privacy_consent: true,
  };
}

async function placeAsAnon(token: string, slot: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role anon");
    await client.query(
      "select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)",
    );
    await client.query("select public.cart_add_item($1, $2, 1)", [token, TRIPLE_SPIKE]);
    const { rows } = await client.query<{ r: { order_id: string } }>(
      "select public.place_order($1, $2, $3::jsonb) as r",
      [token, `race-${randomUUID()}`, JSON.stringify(input(slot))],
    );
    await client.query("commit");
    createdOrders.push(rows[0]!.r.order_id);
    return "ok" as const;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  pool = new Pool({ connectionString, max: 30 });
  date = nextWeekday(12);
});

afterAll(async () => {
  for (const id of createdOrders) {
    await pool.query(
      "select app.release_stock_reservations('order', $1, 'test cleanup')",
      [id],
    );
    await pool.query("delete from public.orders where id = $1", [id]);
  }
  await pool.query(
    "delete from public.delivery_slot_allocations where slot_id = $1 and delivery_date = $2",
    [EVENING_SLOT, date],
  );
  await pool.query(
    "delete from public.carts where token_hash in (select app.sha256_hex(t) from unnest($1::text[]) t)",
    [[]],
  );
  await pool.end();
});

describe("checkout under contention", () => {
  it("only `available` of 12 simultaneous checkouts for the last triple-spike orchid succeed", async () => {
    const { rows } = await pool.query<{ a: number }>(
      "select public.variant_available_quantity($1) as a",
      [TRIPLE_SPIKE],
    );
    const available = rows[0]!.a;
    expect(available).toBeGreaterThan(0);

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        placeAsAnon(
          randomBytes(32).toString("hex"),
          "80000000-0000-4000-8000-000000000002",
        ),
      ),
    );
    const wins = results.filter((r) => r.status === "fulfilled").length;
    const losses = results.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];
    expect(wins).toBe(available);
    losses.forEach((l) =>
      expect(String(l.reason)).toMatch(/Insufficient stock|Only \d+ left|cart changed/),
    );

    const after = await pool.query<{ a: number }>(
      "select public.variant_available_quantity($1) as a",
      [TRIPLE_SPIKE],
    );
    expect(after.rows[0]!.a).toBe(0);
  });

  it("delivery slot capacity is never oversold by concurrent checkouts", async () => {
    // Free the orchids again so stock is not the limiting factor, then force a tiny slot.
    for (const id of createdOrders.splice(0)) {
      await pool.query(
        "select app.release_stock_reservations('order', $1, 'test cleanup')",
        [id],
      );
      await pool.query("delete from public.orders where id = $1", [id]);
    }
    await pool.query(
      "insert into public.delivery_slot_allocations (slot_id, delivery_date, capacity) values ($1, $2, 1) on conflict (slot_id, delivery_date) do update set capacity = 1, booked = 0",
      [EVENING_SLOT, date],
    );
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        placeAsAnon(randomBytes(32).toString("hex"), EVENING_SLOT),
      ),
    );
    const wins = results.filter((r) => r.status === "fulfilled").length;
    expect(wins).toBe(1);
    const loss = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(loss.reason)).toMatch(/slot is no longer available|fully booked/);
    const { rows } = await pool.query<{ booked: number }>(
      "select booked from public.delivery_slot_allocations where slot_id = $1 and delivery_date = $2",
      [EVENING_SLOT, date],
    );
    expect(rows[0]!.booked).toBe(1);
  });
});
