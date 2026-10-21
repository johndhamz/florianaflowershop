import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Weekly retention job (Vercel Cron, Sunday 02:30 Manila → `30 18 * * 0` UTC).
 * Prunes abandoned carts, redacts delivered notification payloads, deletes stale
 * order access tokens and clears proof-of-delivery data past the dispute window.
 * Financial records are never touched. See docs/launch/security-review.md.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("run_retention");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
