import type { Metadata } from "next";
import { Suspense } from "react";

import { PrepQueue } from "@/components/admin/prep/prep-queue";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { requireStaff } from "@/modules/auth/dal";
import { getPreparationQueue } from "@/modules/preparation/queries";

export const metadata: Metadata = { title: "Preparation queue" };

async function Queue({
  searchParams,
}: {
  searchParams: PageProps<"/admin/prep">["searchParams"];
}) {
  await requireStaff("preparation.work");
  const sp = await searchParams;
  const includeReady = sp.ready === "1";
  const queue = await getPreparationQueue(includeReady);
  return <PrepQueue items={queue} includeReady={includeReady} />;
}

export default function PrepPage(props: PageProps<"/admin/prep">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Preparation queue"
        description="Paid orders sorted by delivery deadline. Tap an order to see the recipe, card message and instructions."
      />
      <Suspense fallback={<TableSkeleton rows={5} columns={3} />}>
        <Queue searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
