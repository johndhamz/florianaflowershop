import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

/**
 * Server Supabase client bound to the current request's cookies (anon key, RLS-enforced).
 *
 * Reads `cookies()`, so any component calling this must sit behind a `<Suspense>`
 * boundary when Cache Components are enabled. Never call it at a layout's top level.
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
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
