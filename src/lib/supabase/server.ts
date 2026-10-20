import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Server Supabase client bound to the current request's cookies (anon key, RLS-enforced).
 *
 * Reads `cookies()`, so any component calling this must sit behind a `<Suspense>`
 * boundary when Cache Components are enabled. Never call it at a layout's top level.
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // The proxy (`src/proxy.ts`) refreshes sessions, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Privileged client (service role). Bypasses RLS.
 *
 * ONLY for trusted server paths: checkout transactions, payment webhooks, jobs.
 * Never import from a Client Component, never return it from a Server Action,
 * and always re-check authorization in application code before using it.
 */
export function createAdminClient() {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on this server.");
  }
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
