"use client";

import { MenuIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { AdminNavCloseContext } from "@/components/layout/admin-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AdminMobileNav({ nav }: { nav: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open admin menu"
          className="lg:hidden"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-xs gap-0 p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle asChild>
            <Logo href="/admin" size="sm" />
          </SheetTitle>
          <SheetDescription className="sr-only">Admin navigation</SheetDescription>
        </SheetHeader>
        <div className="px-3 py-3">
          <AdminNavCloseContext.Provider value={() => setOpen(false)}>
            {nav}
          </AdminNavCloseContext.Provider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
