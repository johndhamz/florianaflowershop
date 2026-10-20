import { redirect } from "next/navigation";

import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentStaff } from "@/modules/auth/dal";

/**
 * Reads the session at request time. Rendered behind <Suspense> inside the
 * admin topbar so the static shell streams instantly.
 */
export async function AdminUserMenu() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/admin/login");
  return <UserMenu staff={staff} />;
}

export function AdminUserMenuSkeleton() {
  return (
    <div className="flex items-center gap-2 pr-2 pl-1.5" aria-hidden>
      <Skeleton className="size-7 rounded-full" />
      <Skeleton className="hidden h-4 w-20 sm:block" />
    </div>
  );
}
