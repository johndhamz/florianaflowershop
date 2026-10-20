import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/modules/auth/dal";
import { listRecipes } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Bouquet recipes" };
type Row = Awaited<ReturnType<typeof listRecipes>>[number];

async function Recipes() {
  await requireStaff("inventory.read");
  const rows = await listRecipes();
  const columns: DataTableColumn<Row>[] = [
    {
      id: "product",
      header: "Variant",
      cell: (r) => (
        <div>
          <p className="font-medium">
            {r.products?.name} · {r.name}
          </p>
          <p className="text-xs text-muted-foreground">{r.sku}</p>
        </div>
      ),
    },
    {
      id: "mode",
      header: "Tracking",
      hideBelow: "sm",
      cell: (r) => (
        <StatusBadge
          tone={r.inventory_mode === "recipe" ? "info" : "neutral"}
          dot={false}
        >
          {r.inventory_mode}
        </StatusBadge>
      ),
    },
    {
      id: "lines",
      header: "Materials",
      cell: (r) =>
        r.bouquet_recipes ? (
          <span className="text-muted-foreground">
            {r.bouquet_recipes.recipe_items
              .map((i) => `${i.quantity} ${i.materials?.name}`)
              .join(", ")}
          </span>
        ) : (
          <StatusBadge tone="warning" dot={false}>
            No recipe
          </StatusBadge>
        ),
    },
    {
      id: "time",
      header: "Assembly",
      align: "right",
      hideBelow: "md",
      cell: (r) =>
        r.bouquet_recipes?.assembly_minutes
          ? `${r.bouquet_recipes.assembly_minutes} min`
          : "—",
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/admin/inventory/recipes/${r.id}`}>
            {r.bouquet_recipes ? "Edit" : "Create"}
          </Link>
        </Button>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      caption="Bouquet recipes"
    />
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
      <Recipes />
    </Suspense>
  );
}
