import { NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Uptime probe for monitoring. Unauthenticated, never includes secrets.
 * 200 = app up and database reachable; 503 = database unreachable.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    getPublicEnv();
    const { error } = await createPublicClient()
      .from("business_settings")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) database = "error";
  } catch {
    database = "error";
  }
  const body = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    latency_ms: Date.now() - startedAt,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    status: database === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
