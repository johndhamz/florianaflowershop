import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";

import { AdminNav } from "@/components/layout/admin-nav";
import { AdminSessionNav } from "@/components/layout/admin-session-nav";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import {
  AdminUserMenu,
  AdminUserMenuSkeleton,
} from "@/components/layout/admin-user-menu";
import { SkipLink } from "@/components/layout/skip-link";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Floriana Flowers" },
  robots: { index: false, follow: false },
};

/**
 * Admin shell. The session read lives inside <Suspense> (AdminUserMenu) so the
 * layout itself stays static. Authorization for data happens in each page's
 * data access (requireStaff) and in the database (RLS).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-ivory-100">
      <SkipLink />
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          nav={
            <Suspense fallback={<AdminNav />}>
              <AdminSessionNav />
            </Suspense>
          }
          userMenu={
            <Suspense fallback={<AdminUserMenuSkeleton />}>
              <AdminUserMenu />
            </Suspense>
          }
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
