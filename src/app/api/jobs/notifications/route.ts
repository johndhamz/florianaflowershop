import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { runNotificationOutbox } from "@/modules/notifications/runner";

/** Cron: deliver queued notifications (email; SMS only when enabled) and queue the daily low-stock digest. */
export async function GET(request: Request) {
  const env = getServerEnv();
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: lowStock } = await admin.rpc("enqueue_low_stock_digest");
  try {
    const summary = await runNotificationOutbox({ limit: 50 });
    return NextResponse.json({ ...summary, low_stock_items: lowStock ?? 0 });
  } catch (err) {
    console.error("notification run failed", err);
    return NextResponse.json({ error: "run failed" }, { status: 500 });
  }
}
