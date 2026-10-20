import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Scheduled job (Vercel Cron → `Authorization: Bearer $CRON_SECRET`):
 * releases stock + slots for unpaid orders past their hold, expires stale
 * reservations and perished batches.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const [orders, reservations, batches] = await Promise.all([
    admin.rpc("expire_unpaid_orders"),
    admin.rpc("expire_stock_reservations"),
    admin.rpc("expire_stock_batches"),
  ]);
  const errors = [orders.error, reservations.error, batches.error]
    .filter(Boolean)
    .map((e) => e!.message);
  return NextResponse.json(
    {
      expired_orders: orders.data ?? 0,
      expired_reservations: reservations.data ?? 0,
      expired_batches: batches.data ?? 0,
      errors,
    },
    { status: errors.length ? 500 : 200 },
  );
}
