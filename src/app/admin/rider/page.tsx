import type { Metadata } from "next";
import { Suspense } from "react";

import { RiderDashboard } from "@/components/admin/rider/rider-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/modules/auth/dal";
import { getRiderDeliveries } from "@/modules/delivery/admin-queries";

export const metadata: Metadata = { title: "My deliveries" };

async function Deliveries({
  searchParams,
}: {
  searchParams: PageProps<"/admin/rider">["searchParams"];
}) {
  await requireStaff("delivery.ride");
  const sp = await searchParams;
  const includeDone = sp.done === "1";
  const deliveries = await getRiderDeliveries(includeDone);
  return <RiderDashboard deliveries={deliveries} includeDone={includeDone} />;
}

export default function RiderPage(props: PageProps<"/admin/rider">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="My deliveries"
        description="Your assigned deliveries for yesterday, today and tomorrow."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <Deliveries searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
