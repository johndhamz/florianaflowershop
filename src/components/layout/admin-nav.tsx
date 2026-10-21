"use client";

import { createContext, useContext } from "react";

import { NavLink } from "@/components/layout/nav-link";
import { adminNav } from "@/config/admin-nav";
import { cn } from "@/lib/utils";
import { roleCan } from "@/modules/auth/permissions";
import type { StaffRole } from "@/modules/auth/types";

/** Lets a server-rendered nav close the mobile sheet that wraps it. */
export const AdminNavCloseContext = createContext<(() => void) | null>(null);

type AdminNavProps = {
  /** Items gated by a permission are hidden until the role is known. */
  role?: StaffRole | null;
  onNavigate?: () => void;
  className?: string;
};

export function AdminNav({ role, onNavigate, className }: AdminNavProps) {
  const close = useContext(AdminNavCloseContext);
  const handleNavigate = onNavigate ?? close ?? undefined;
  const items = adminNav.filter(
    (item) => !item.permission || (role ? roleCan(role, item.permission) : false),
  );
  return (
    <nav aria-label="Admin" className={cn("flex-1", className)}>
      <ul className="flex flex-col gap-0.5">
        {items.map(({ label, href, icon: Icon, matchNested }) => (
          <li key={href}>
            <NavLink
              href={href}
              matchNested={matchNested}
              onClick={handleNavigate}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 focus-visible:outline-none"
              activeClassName="bg-sidebar-accent text-sidebar-foreground"
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
