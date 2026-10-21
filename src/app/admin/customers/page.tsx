import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatManila } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";

export const metadata: Metadata = { title: "Customers" };

type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  orders: { count: number }[];
};

const columns: DataTableColumn<Row>[] = [
  {
    id: "n",
    header: "Customer",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {r.email}
          {r.phone ? ` · ${r.phone}` : ""}
        </p>
      </div>
    ),
  },
  {
    id: "o",
    header: "Orders",
    align: "right",
    cell: (r) => <span className="tabular-nums">{r.orders[0]?.count ?? 0}</span>,
  },
  {
    id: "m",
    header: "Marketing",
    hideBelow: "md",
    cell: (r) => (
      <span className="text-xs">{r.marketing_opt_in ? "Opted in" : "No"}</span>
    ),
  },
  {
    id: "s",
    header: "Since",
    hideBelow: "sm",
    cell: (r) => (
      <span className="text-xs text-muted-foreground">
        {formatManila(r.created_at, { dateStyle: "medium" })}
      </span>
    ),
  },
];

async function Customers({
  searchParams,
}: {
  searchParams: PageProps<"/admin/customers">["searchParams"];
}) {
  await requireStaff("customers.update"); // owner, manager, support: florists and riders never see contact details
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, full_name, email, phone, marketing_opt_in, created_at, orders ( count )")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q)
    query = query.or(
      `full_name.ilike.%${q.replaceAll(",", " ")}%,email.ilike.%${q.replaceAll(",", " ")}%`,
    );
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Name or email"
            className="h-9 w-64 bg-card"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        <p className="text-xs text-muted-foreground">
          {rows.length} customers · personal data: view only what you need
        </p>
      </form>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        caption="Customers"
        emptyState={<p className="text-sm text-muted-foreground">No customers match.</p>}
      />
    </div>
  );
}

export default function AdminCustomersPage(props: PageProps<"/admin/customers">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Customers"
        description="Guest checkout customers, de-duplicated by email. Access is limited to owner, manager and support."
      />
      <Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
        <Customers searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
