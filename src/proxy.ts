import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only admin routes carry a session in Phase 1. Storefront stays fully static.
  matcher: ["/admin/:path*"],
};
