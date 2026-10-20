import type { Metadata } from "next";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Suspense } from "react";

import { Qty } from "@/components/admin/inventory/qty";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireStaff } from "@/modules/auth/dal";
import { listReconciliation } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Inventory reconciliation" };
type Row = Awaited<ReturnType<typeof listReconciliation>>[number];

async function Reconciliation() {
  await requireStaff("inventory.read");
  const rows = await listReconciliation();
  const unbalanced = rows.filter((r) => !r.balanced).length;
  const columns: DataTableColumn<Row>[] = [
    {
      id: "batch",
      header: "Batch",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.batch_code}</p>
          <p className="text-xs text-muted-foreground">{r.material}</p>
        </div>
      ),
    },
    {
      id: "received",
      header: "Received",
      align: "right",
      hideBelow: "sm",
      cell: (r) => <Qty value={Number(r.quantity_received)} />,
    },
    {
      id: "out",
      header: "Journal out/adjust",
      align: "right",
      hideBelow: "md",
      cell: (r) => <Qty value={Number(r.journal_out_and_adjust)} />,
    },
    {
      id: "expected",
      header: "Expected",
      align: "right",
      hideBelow: "md",
      cell: (r) => <Qty value={Number(r.expected_remaining)} />,
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      cell: (r) => <Qty value={Number(r.quantity_remaining)} />,
    },
    {
      id: "reserved",
      header: "Reserved / holds",
      align: "right",
      hideBelow: "lg",
      cell: (r) => (
        <span className="tabular-nums">
          {Number(r.quantity_reserved)} / {Number(r.active_reservations)}
        </span>
      ),
    },
    {
      id: "ok",
      header: "Balanced",
      cell: (r) =>
        r.balanced ? (
          <StatusBadge tone="success" dot={false}>
            <CheckCircle2Icon aria-hidden className="size-3" />
            Yes
          </StatusBadge>
        ) : (
          <StatusBadge tone="danger" dot={false}>
            <XCircleIcon aria-hidden className="size-3" />
            No
          </StatusBadge>
        ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" data-testid="reconciliation-summary">
        {rows.length} batches ·{" "}
        {unbalanced === 0 ? "all balanced" : `${unbalanced} unbalanced`}. A batch balances
        when <em>remaining = received + journaled consumption/wastage/adjustments</em> and{" "}
        <em>reserved = sum of its active holds</em>.
      </p>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.batch_id!}
        caption="Reconciliation"
      />
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
      <Reconciliation />
    </Suspense>
  );
}
