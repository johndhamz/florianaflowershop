import type { Metadata } from "next";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { CoverageChecker } from "@/components/storefront/coverage-checker";
import { formatCentavos } from "@/lib/money";
import {
  deliveryInfoSchema,
  getBusinessSettings,
  getContent,
} from "@/modules/content/queries";
import { listDeliverySlots, listDeliveryZones } from "@/modules/delivery/queries";

export const metadata: Metadata = {
  title: "Delivery information",
  description:
    "Where we deliver in Cebu, delivery fees per zone, same-day cutoffs and time slots.",
  alternates: { canonical: "/delivery" },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hour12 = ((h! + 11) % 12) + 1;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h! >= 12 ? "PM" : "AM"}`;
}

function describeDays(days: number[]) {
  const sorted = [...days].sort();
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5,6") return "Mon – Sat";
  if (sorted.join() === "1,2,3,4,5") return "Mon – Fri";
  return sorted.map((d) => DAY_LABELS[d]).join(", ");
}

export default async function DeliveryPage() {
  const [info, zones, slots, settings] = await Promise.all([
    getContent("delivery.info", deliveryInfoSchema),
    listDeliveryZones(),
    listDeliverySlots(),
    getBusinessSettings(),
  ]);

  return (
    <Container className="flex flex-col gap-10 py-10 sm:py-14">
      <PageHeader
        eyebrow="Delivery"
        title={info?.title ?? "Delivery information"}
        description={info?.body}
      />

      <CoverageChecker className="max-w-3xl" />

      <section aria-labelledby="zones-heading" className="flex flex-col gap-4">
        <h2 id="zones-heading" className="font-serif text-2xl font-semibold">
          Zones and fees
        </h2>
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <caption className="sr-only">Delivery zones, fees and cutoffs</caption>
            <thead className="bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Zone
                </th>
                <th scope="col" className="px-4 py-3">
                  Fee
                </th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell">
                  Free delivery
                </th>
                <th scope="col" className="px-4 py-3">
                  Same-day cutoff
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {zones.map((z) => (
                <tr key={z.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{z.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {z.barangays.slice(0, 6).join(", ")}
                      {z.barangays.length > 6 ? "…" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCentavos(z.feeCentavos)}
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums sm:table-cell">
                    {z.freeDeliveryThresholdCentavos
                      ? `Orders over ${formatCentavos(z.freeDeliveryThresholdCentavos)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {z.sameDayCutoff
                      ? `Before ${formatTime(z.sameDayCutoff)}`
                      : `${z.leadTimeHours}h lead time`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="slots-heading" className="flex flex-col gap-4">
        <h2 id="slots-heading" className="font-serif text-2xl font-semibold">
          Delivery time slots
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {slots.map((s) => (
            <li key={s.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="font-medium">{s.label}</p>
              <p className="text-sm text-muted-foreground">
                {formatTime(s.startsAt)} – {formatTime(s.endsAt)} ·{" "}
                {describeDays(s.daysOfWeek)}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Slots are capped per day so every bouquet gets the time it deserves. Same-day
          orders must be placed before {formatTime(settings.same_day_cutoff)} in eligible
          zones.
        </p>
      </section>
    </Container>
  );
}
