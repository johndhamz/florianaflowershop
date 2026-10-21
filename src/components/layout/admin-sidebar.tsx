import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/layout/admin-nav";
import { AdminSessionNav } from "@/components/layout/admin-session-nav";

export function AdminSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo href="/admin" size="sm" />
        <span className="ml-2 rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-sidebar-foreground/70 uppercase">
          Admin
        </span>
      </div>
      <div className="flex flex-1 flex-col px-3 py-4">
        <Suspense fallback={<AdminNav />}>
          <AdminSessionNav />
        </Suspense>
        <div className="mt-auto border-t border-sidebar-border pt-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ExternalLinkIcon aria-hidden className="size-3.5" />
            View storefront
          </Link>
        </div>
      </div>
    </aside>
  );
}
