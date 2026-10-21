import type { Metadata } from "next";
import { Suspense } from "react";

import { DispatchBoard } from "@/components/admin/dispatch/dispatch-board";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { requireStaff } from "@/modules/auth/dal";
import { getDispatchBoard, listRiders } from "@/modules/delivery/admin-queries";
import { listDeliverySlots } from "@/modules/delivery/queries";

export const metadata: Metadata = { title: "Dispatch board" };

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

async function Board({
  searchParams,
}: {
  searchParams: PageProps<"/admin/dispatch">["searchParams"];
}) {
  const staff = await requireStaff("delivery.board");
  const sp = await searchParams;
  const date =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : sp.date === "all"
        ? null
        : manilaToday();
  const [rows, riders, slots] = await Promise.all([
    getDispatchBoard(date),
    listRiders(),
    listDeliverySlots(),
  ]);
  return (
    <DispatchBoard
      rows={rows}
      riders={riders
        .filter((r) => r.is_active)
        .map((r) => ({ id: r.user_id, name: r.display_name }))}
      slots={slots.map((s) => ({ id: s.id, label: s.label }))}
      date={date}
      canDispatch={staff.role === "owner" || staff.role === "manager"}
    />
  );
}

export default function DispatchPage(props: PageProps<"/admin/dispatch">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Dispatch board"
        description="Assign riders, follow deliveries, and resolve exceptions. Times are Asia/Manila."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={6} />}>
        <Board searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
