"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig, storefrontNav } from "@/config/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-sm gap-0 p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle asChild>
            <Logo size="sm" withTagline />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Browse {siteConfig.name} collections and help pages.
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col">
            {storefrontNav.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  matchNested
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground/85 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  activeClassName="bg-accent text-foreground"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t px-5 py-4">
          <Button className="w-full" size="lg" asChild>
            <Link href="/shop" onClick={() => setOpen(false)}>
              Shop now
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
