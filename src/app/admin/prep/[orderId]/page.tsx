import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PrepWorkspace } from "@/components/admin/prep/prep-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/modules/auth/dal";
import { listMaterials } from "@/modules/inventory/queries";
import {
  getArrangementPhotoUrl,
  getPreparationDetails,
} from "@/modules/preparation/queries";

export const metadata: Metadata = { title: "Prepare order" };

async function Workspace({
  params,
}: {
  params: PageProps<"/admin/prep/[orderId]">["params"];
}) {
  const staff = await requireStaff("preparation.work");
  const { orderId } = await params;
  const [details, materials] = await Promise.all([
    getPreparationDetails(orderId),
    listMaterials(),
  ]);
  if (!details) notFound();
  const photoUrl = await getArrangementPhotoUrl(details.order.arrangement_photo_path);
  return (
    <PrepWorkspace
      details={details}
      photoUrl={photoUrl}
      materials={materials
        .filter((m) => m.is_active)
        .map((m) => ({ id: m.id, name: m.name, unit: m.unit, category: m.category }))}
      isAdmin={staff.role === "owner" || staff.role === "manager"}
    />
  );
}

export default function PrepOrderPage(props: PageProps<"/admin/prep/[orderId]">) {
  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" asChild>
        <Link href="/admin/prep">
          <ArrowLeftIcon data-icon="inline-start" />
          Queue
        </Link>
      </Button>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Workspace params={props.params} />
      </Suspense>
    </div>
  );
}
