import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { formatManila } from "@/lib/datetime";
import { formatCentavos } from "@/lib/money";
import type { AdminOrderRow } from "@/modules/orders/admin-queries";

const TONE: Record<string, StatusTone> = {
  pending: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "neutral",
  unpaid: "warning",
  paid: "success",
  failed: "danger",
  refunded: "info",
  partially_refunded: "info",
  unfulfilled: "neutral",
  preparing: "info",
  ready: "success",
  fulfilled: "success",
  scheduled: "info",
  out_for_delivery: "info",
  delivered: "success",
};

function badge(value: string) {
  return (
    <StatusBadge tone={TONE[value] ?? "neutral"} dot={false}>
      {value.replaceAll("_", " ")}
    </StatusBadge>
  );
}

const columns: DataTableColumn<AdminOrderRow>[] = [
  {
    id: "n",
    header: "Order",
    cell: (r) => (
      <div>
        <Link
          href={`/admin/orders/${r.order_id}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          {r.order_number}
        </Link>
        <p className="text-xs text-muted-foreground">{formatManila(r.placed_at)}</p>
      </div>
    ),
  },
  {
    id: "c",
    header: "Customer",
    hideBelow: "sm",
    cell: (r) => <span>{r.customer_name}</span>,
  },
  { id: "s", header: "Status", cell: (r) => badge(r.status) },
  { id: "p", header: "Payment", hideBelow: "md", cell: (r) => badge(r.payment_status) },
  {
    id: "f",
    header: "Prep · Delivery",
    hideBelow: "lg",
    cell: (r) => (
      <span className="flex flex-wrap gap-1">
        {badge(r.fulfillment_status)}
        {badge(r.delivery_status)}
      </span>
    ),
  },
  {
    id: "d",
    header: "Delivery",
    hideBelow: "md",
    cell: (r) => (
      <span className="text-xs">
        {r.delivery_date}
        <br />
        <span className="text-muted-foreground">{r.zone_name ?? ""}</span>
      </span>
    ),
  },
  {
    id: "t",
    header: "Total",
    align: "right",
    cell: (r) => <span className="tabular-nums">{formatCentavos(r.total_centavos)}</span>,
  },
];

export function OrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.order_id}
      caption="Orders"
      emptyState={<p className="text-sm text-muted-foreground">No orders match.</p>}
    />
  );
}
