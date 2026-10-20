"use client";

import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/modules/auth/actions";
import { STAFF_ROLE_LABELS, type StaffUser } from "@/modules/auth/types";

export function UserMenu({ staff }: { staff: StaffUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 pr-2 pl-1.5" aria-label="Account menu">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-blush-200 text-cocoa">
            <UserIcon aria-hidden className="size-4" />
          </span>
          <span className="hidden text-sm sm:inline">{staff.displayName}</span>
          <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{staff.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {STAFF_ROLE_LABELS[staff.role]} · {staff.email}
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
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOutIcon aria-hidden />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
