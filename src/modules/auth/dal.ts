import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { type Permission, roleCan } from "./permissions";
import { ForbiddenError, type StaffUser, UnauthorizedError } from "./types";

/**
 * Data Access Layer for staff identity.
 *
 * `getCurrentStaff` reads the session cookie, so callers must run at request
 * time behind a `<Suspense>` boundary. It is memoised per request with
 * React `cache` so layouts, pages and actions share one lookup.
 */
export const getCurrentStaff = cache(async (): Promise<StaffUser | null> => {
  // Explicitly request-time: the Supabase client reads the clock while loading the
  // session, which Cache Components would otherwise flag during prerendering.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("user_id, role, display_name, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile.display_name,
    role: profile.role,
  };
});

/** Throws if there is no active staff session. Optionally enforces a permission. */
export async function requireStaff(permission?: Permission): Promise<StaffUser> {
  const staff = await getCurrentStaff();
  if (!staff) throw new UnauthorizedError();
  if (permission && !roleCan(staff.role, permission)) throw new ForbiddenError();
  return staff;
}
