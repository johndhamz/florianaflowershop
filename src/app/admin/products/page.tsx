import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCentavos } from "@/lib/money";
import { requireStaff } from "@/modules/auth/dal";
import { listAdminProducts } from "@/modules/catalog/admin-queries";

export const metadata: Metadata = { title: "Products" };

type Row = Awaited<ReturnType<typeof listAdminProducts>>[number];

const columns: DataTableColumn<Row>[] = [
  {
    id: "n",
    header: "Product",
    cell: (r) => (
      <div>
        <Link
          href={`/admin/products/${r.id}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          {r.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {r.collections?.name ?? "—"} · /shop/{r.slug}
        </p>
      </div>
    ),
  },
  {
    id: "s",
    header: "Status",
    cell: (r) => (
      <StatusBadge
        tone={
          r.status === "active" ? "success" : r.status === "draft" ? "warning" : "neutral"
        }
        dot={false}
      >
        {r.status}
      </StatusBadge>
    ),
  },
  {
    id: "f",
    header: "Flags",
    hideBelow: "md",
    cell: (r) => (
      <span className="text-xs text-muted-foreground">
        {[r.is_featured ? "featured" : null, r.is_best_seller ? "best seller" : null]
          .filter(Boolean)
          .join(" · ") || "—"}
      </span>
    ),
  },
  {
    id: "v",
    header: "Variants",
    hideBelow: "sm",
    cell: (r) => (
      <span className="text-xs">
        {r.product_variants
          .map(
            (v) =>
              `${v.name} ${formatCentavos(v.price_centavos)}${v.is_active ? "" : " (off)"}`,
          )
          .join(" · ")}
      </span>
    ),
  },
];

async function Products() {
  await requireStaff("catalog.manage");
  const rows = await listAdminProducts();
  return (
    <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} caption="Products" />
  );
}

export default function AdminProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Products"
        description="Names, descriptions, visibility, flags and variant prices. Recipes and stock live under Inventory; images are managed in Supabase Storage."
      />
      <Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
        <Products />
      </Suspense>
    </div>
  );
}
