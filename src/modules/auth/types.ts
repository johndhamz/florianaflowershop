import type { Database } from "@/lib/supabase/database.types";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

export const STAFF_ROLES = [
  "owner",
  "manager",
  "florist",
  "rider",
  "support",
] as const satisfies readonly StaffRole[];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  florist: "Florist",
  rider: "Rider",
  support: "Support",
};

/** Narrow, non-sensitive view of the signed-in staff member. */
export type StaffUser = {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
};

export class UnauthorizedError extends Error {
  constructor(message = "Sign in required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
