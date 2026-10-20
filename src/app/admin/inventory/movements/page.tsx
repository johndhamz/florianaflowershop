import type { Metadata } from "next";
import { Suspense } from "react";

import { Qty } from "@/components/admin/inventory/qty";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatManila } from "@/lib/datetime";
import { requireStaff } from "@/modules/auth/dal";
import { listMaterials, listMovements } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Stock movements" };
type Movement = Awaited<ReturnType<typeof listMovements>>[number];
const tone: Record<string, StatusTone> = {
  receive: "success",
  reserve: "info",
  release: "neutral",
  consume: "brand",
  adjust: "warning",
  discard: "danger",
  expire: "danger",
};

async function Movements({
  searchParams,
}: {
  searchParams: PageProps<"/admin/inventory/movements">["searchParams"];
}) {
  await requireStaff("inventory.read");
  const sp = await searchParams;
  const type = typeof sp.type === "string" && sp.type ? sp.type : undefined;
  const materialId =
    typeof sp.material === "string" && sp.material ? sp.material : undefined;
  const [movements, materials] = await Promise.all([
    listMovements({ type, materialId, limit: 300 }),
    listMaterials(),
  ]);
  const columns: DataTableColumn<Movement>[] = [
    {
      id: "when",
      header: "When",
      cell: (m) => (
        <span className="text-muted-foreground">{formatManila(m.created_at)}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (m) => (
        <StatusBadge tone={tone[m.movement_type] ?? "neutral"} dot={false}>
          {m.movement_type}
        </StatusBadge>
      ),
    },
    {
      id: "material",
      header: "Material",
      cell: (m) => (
        <div>
          <p className="font-medium">{m.materials?.name}</p>
          <p className="text-xs text-muted-foreground">{m.stock_batches?.batch_code}</p>
        </div>
      ),
    },
    {
      id: "qty",
      header: "Quantity",
      align: "right",
      cell: (m) => (
        <Qty
          value={Number(m.quantity)}
          unit={m.materials?.unit}
          className={Number(m.quantity) < 0 ? "text-destructive" : "text-success"}
        />
      ),
    },
    {
      id: "ref",
      header: "Reference",
      hideBelow: "md",
      cell: (m) => (
        <span className="text-muted-foreground">
          {m.reference_type ? `${m.reference_type} ${m.reference_id?.slice(0, 8)}` : "—"}
        </span>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      hideBelow: "lg",
      cell: (m) => (
        <span className="text-muted-foreground">
          {m.reason ?? m.wastage_reason ?? "—"}
        </span>
      ),
    },
    {
      id: "by",
      header: "By",
      hideBelow: "lg",
      cell: (m) => (
        <span className="text-muted-foreground">{m.created_by_name ?? "system"}</span>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Type
          <select
            name="type"
            defaultValue={type ?? ""}
            className="h-9 rounded-lg border border-input bg-card px-2 text-sm text-foreground"
          >
            <option value="">All</option>
            {[
              "receive",
              "reserve",
              "release",
              "consume",
              "adjust",
              "discard",
              "expire",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Material
          <select
            name="material"
            defaultValue={materialId ?? ""}
            className="h-9 min-w-48 rounded-lg border border-input bg-card px-2 text-sm text-foreground"
          >
            <option value="">All</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <DataTable
        columns={columns}
        rows={movements}
        getRowId={(m) => m.id}
        caption="Stock movements"
      />
    </div>
  );
}

export default function MovementsPage(props: PageProps<"/admin/inventory/movements">) {
  return (
    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
      <Movements searchParams={props.searchParams} />
    </Suspense>
  );
}
