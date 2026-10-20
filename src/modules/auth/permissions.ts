import type { StaffRole } from "./types";

/**
 * Application-level capability map. Mirrors the database RLS policies so the UI
 * can hide what the database would reject anyway. The database remains the
 * source of truth: never rely on this map alone for security.
 */
export const PERMISSIONS = {
  "orders.read": ["owner", "manager", "florist", "support", "rider"],
  "orders.create": ["owner", "manager"],
  "orders.cancel": ["owner", "manager", "support"],
  "orders.fulfillment.update": ["owner", "manager", "florist"],
  "orders.delivery.update": ["owner", "manager", "rider"],
  "orders.notes.update": ["owner", "manager", "florist", "support"],
  "customers.read": ["owner", "manager", "florist", "support"],
  "customers.update": ["owner", "manager", "support"],
  "catalog.manage": ["owner", "manager"],
  "inventory.read": ["owner", "manager", "florist"],
  "inventory.manage": ["owner", "manager", "florist"],
  "inventory.adjust": ["owner", "manager"],
  "preparation.work": ["owner", "manager", "florist"],
  "delivery.manage": ["owner", "manager"],
  "payments.read": ["owner", "manager", "support"],
  "payments.verify": ["owner", "manager"],
  "refunds.manage": ["owner", "manager"],
  "promos.manage": ["owner", "manager"],
  "settings.manage": ["owner", "manager"],
  "staff.manage": ["owner", "manager"],
  "staff.grant_owner": ["owner"],
  "audit.read": ["owner", "manager"],
} as const satisfies Record<string, readonly StaffRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleCan(role: StaffRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly StaffRole[]).includes(role);
}
