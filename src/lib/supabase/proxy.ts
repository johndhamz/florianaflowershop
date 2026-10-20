import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on each matched request and forwards the
 * updated cookies to both the server components and the browser.
 *
 * Authorization decisions are NOT made here — they belong to server-side checks
 * and database RLS. This only keeps tokens fresh. Route gating arrives with auth.
 */
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not add logic between client creation and getUser(): it can cause
  // random logouts by desynchronising the cookie jar.
  await supabase.auth.getUser();

  return response;
}
