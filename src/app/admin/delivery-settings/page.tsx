import type { Metadata } from "next";
import { Suspense } from "react";

import { DeliverySettings } from "@/components/admin/dispatch/delivery-settings";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { requireStaff } from "@/modules/auth/dal";
import { getBusinessSettings } from "@/modules/content/queries";
import {
  listAllocations,
  listSlotsAdmin,
  listZonesAdmin,
} from "@/modules/delivery/admin-queries";

export const metadata: Metadata = { title: "Delivery settings" };

function manilaDate(offset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + offset * 86_400_000),
  );
}

async function Settings() {
  await requireStaff("delivery.manage");
  const [zones, slots, allocations, settings] = await Promise.all([
    listZonesAdmin(),
    listSlotsAdmin(),
    listAllocations(manilaDate(0), manilaDate(14)),
    getBusinessSettings(),
  ]);
  return (
    <DeliverySettings
      zones={zones.map((z) => ({
        id: z.id,
        slug: z.slug,
        name: z.name,
        city: z.city,
        province: z.province,
        barangays: z.barangays,
        fee_centavos: z.fee_centavos,
        free_delivery_threshold_centavos: z.free_delivery_threshold_centavos,
        min_order_centavos: z.min_order_centavos,
        same_day_cutoff: z.same_day_cutoff ? z.same_day_cutoff.slice(0, 5) : null,
        lead_time_hours: z.lead_time_hours,
        is_active: z.is_active,
        position: z.position,
      }))}
      slots={slots.map((s) => ({
        id: s.id,
        label: s.label,
        starts_at: s.starts_at.slice(0, 5),
        ends_at: s.ends_at.slice(0, 5),
        days_of_week: s.days_of_week,
        default_capacity: s.default_capacity,
        is_active: s.is_active,
        position: s.position,
      }))}
      allocations={allocations.map((a) => ({
        id: a.id,
        slot_id: a.slot_id,
        slot_label: a.delivery_slots?.label ?? "",
        delivery_date: a.delivery_date,
        capacity: a.capacity,
        booked: a.booked,
        is_blocked: a.is_blocked,
      }))}
      defaultCutoff={settings.same_day_cutoff.slice(0, 5)}
    />
  );
}

export default function DeliverySettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Delivery settings"
        description="Zones and barangays, fees, same-day cutoffs, slot templates and per-date capacity."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
        <Settings />
      </Suspense>
    </div>
  );
}
