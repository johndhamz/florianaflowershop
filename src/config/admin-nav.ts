import type { LucideIcon } from "lucide-react";
import {
  BikeIcon,
  BoxesIcon,
  CreditCardIcon,
  FlowerIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /admin/orders/123). */
  matchNested?: boolean;
};

export const adminNav: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboardIcon },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBagIcon, matchNested: true },
  { label: "Payments", href: "/admin/payments", icon: CreditCardIcon, matchNested: true },
  { label: "Products", href: "/admin/products", icon: FlowerIcon, matchNested: true },
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
  { label: "Customers", href: "/admin/customers", icon: UsersIcon, matchNested: true },
  { label: "Settings", href: "/admin/settings", icon: SettingsIcon, matchNested: true },
] as const;
