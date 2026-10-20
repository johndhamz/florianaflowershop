"use client";

import {
  BellIcon,
  ChevronDownIcon,
  LogOutIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function AdminTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <AdminMobileNav />

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 pr-2 pl-1.5"
              aria-label="Account menu"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-blush-200 text-cocoa">
                <UserIcon aria-hidden className="size-4" />
              </span>
              <span className="hidden text-sm sm:inline">Shop staff</span>
              <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">Shop staff</p>
              <p className="text-xs text-muted-foreground">
                Sign-in arrives with auth phase
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/">View storefront</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <LogOutIcon aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
