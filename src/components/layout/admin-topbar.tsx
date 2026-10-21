"use client";

import { BellIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminTopbar({ userMenu, nav }: { userMenu: ReactNode; nav: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <AdminMobileNav nav={nav} />

      <form
        role="search"
        className="relative hidden max-w-md flex-1 sm:block"
        onSubmit={(event) => {
          event.preventDefault();
          toast.info("Search arrives with the orders module.");
        }}
      >
        <label htmlFor="admin-search" className="sr-only">
          Search orders, products and customers
        </label>
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="admin-search"
          type="search"
          name="q"
          placeholder="Search orders, products, customers…"
          className="h-9 bg-card pl-8"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          onClick={() => toast("No new notifications")}
        >
          <BellIcon />
        </Button>
        {userMenu}
      </div>
    </header>
  );
}
