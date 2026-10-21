import type { Metadata } from "next";
import { Suspense } from "react";

import { OrdersTable } from "@/components/admin/orders/orders-table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/modules/auth/dal";
import { listAdminOrders } from "@/modules/orders/admin-queries";

export const metadata: Metadata = { title: "Orders" };

const STATUSES = ["all", "pending", "confirmed", "completed", "cancelled"] as const;

async function Orders({
  searchParams,
}: {
  searchParams: PageProps<"/admin/orders">["searchParams"];
}) {
  await requireStaff("orders.read");
  const sp = await searchParams;
  const status =
    typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status)
      ? sp.status
      : "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const rows = await listAdminOrders({ status, q });
  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Order number, name or email"
            className="h-9 w-64 bg-card"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        <p className="text-xs text-muted-foreground">{rows.length} orders</p>
      </form>
      <OrdersTable rows={rows} />
    </div>
  );
}

export default function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Orders"
        description="Every order with payment, preparation and delivery state. Open an order to cancel it or add internal notes."
      />
      <Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
        <Orders searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
