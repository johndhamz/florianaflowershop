import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Cookie-less anon client for public catalog/content reads.
 * Safe inside `"use cache"` functions because it never touches request data;
 * RLS still applies (anon sees only active/published rows).
 */
export function createPublicClient() {
  client ??= createClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    getPublicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
