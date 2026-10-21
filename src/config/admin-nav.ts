import type { LucideIcon } from "lucide-react";

import type { Permission } from "@/modules/auth/permissions";
import {
  BarChart3Icon,
  BikeIcon,
  BoxesIcon,
  CreditCardIcon,
  FileTextIcon,
  FlowerIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /admin/orders/123). */
  matchNested?: boolean;
  /** Shown only to roles holding this permission (pages enforce it again server-side). */
  permission?: Permission;
};

export const adminNav: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboardIcon },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBagIcon, matchNested: true },
  { label: "Payments", href: "/admin/payments", icon: CreditCardIcon, matchNested: true },
  {
    label: "Products",
    href: "/admin/products",
    icon: FlowerIcon,
    matchNested: true,
    permission: "catalog.manage",
  },
  { label: "Preparation", href: "/admin/prep", icon: FlowerIcon, matchNested: true },
  { label: "Inventory", href: "/admin/inventory", icon: BoxesIcon, matchNested: true },
  { label: "Dispatch", href: "/admin/dispatch", icon: TruckIcon, matchNested: true },
  { label: "My deliveries", href: "/admin/rider", icon: BikeIcon, matchNested: true },
  {
    label: "Delivery settings",
    href: "/admin/delivery-settings",
    icon: MapPinIcon,
    matchNested: true,
  },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: UsersIcon,
    matchNested: true,
    permission: "customers.update",
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: BarChart3Icon,
    matchNested: true,
    permission: "reports.read",
  },
  {
    label: "Promotions",
    href: "/admin/promotions",
    icon: TagIcon,
    matchNested: true,
    permission: "promos.manage",
  },
  {
    label: "Content",
    href: "/admin/content",
    icon: FileTextIcon,
    matchNested: true,
    permission: "content.manage",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: SettingsIcon,
    matchNested: true,
    permission: "settings.manage",
  },
] as const;
