import { AdminNav } from "@/components/layout/admin-nav";
import { getCurrentStaff } from "@/modules/auth/dal";

/**
 * Reads the session so permission-gated destinations (reports, promotions, content)
 * only appear for roles that hold them. Render behind <Suspense fallback={<AdminNav />}>.
 */
export async function AdminSessionNav() {
  const staff = await getCurrentStaff();
  return <AdminNav role={staff?.role ?? null} />;
}
