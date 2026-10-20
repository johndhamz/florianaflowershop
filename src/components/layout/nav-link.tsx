"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link> & {
  href: string;
  /** Treat nested paths as active (e.g. /admin/orders/123 → /admin/orders). */
  matchNested?: boolean;
  activeClassName?: string;
};

/**
 * Link that reports the current page to assistive tech via `aria-current`.
 * Client component because layouts cannot read the pathname.
 */
export function NavLink({
  href,
  matchNested = false,
  className,
  activeClassName,
  ...props
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = matchNested
    ? pathname === href || pathname.startsWith(`${href}/`)
    : pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive ? "" : undefined}
      className={cn(className, isActive && activeClassName)}
      {...props}
    />
  );
}
