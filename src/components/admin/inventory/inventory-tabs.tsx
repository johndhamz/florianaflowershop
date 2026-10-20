"use client";

import { NavLink } from "@/components/layout/nav-link";

const tabs = [
  { href: "/admin/inventory", label: "Overview" },
  { href: "/admin/inventory/materials", label: "Materials" },
  { href: "/admin/inventory/suppliers", label: "Suppliers" },
  { href: "/admin/inventory/batches", label: "Batches" },
  { href: "/admin/inventory/receive", label: "Receive" },
  { href: "/admin/inventory/wastage", label: "Wastage" },
  { href: "/admin/inventory/movements", label: "Movements" },
  { href: "/admin/inventory/recipes", label: "Recipes" },
  { href: "/admin/inventory/reconciliation", label: "Reconciliation" },
];

export function InventoryTabs() {
  return (
    <nav
      aria-label="Inventory sections"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max gap-1 rounded-xl bg-muted/60 p-1 sm:w-auto">
        {tabs.map((t) => (
          <li key={t.href}>
            <NavLink
              href={t.href}
              matchNested={t.href !== "/admin/inventory"}
              className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground"
              activeClassName="bg-card text-foreground shadow-sm"
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
