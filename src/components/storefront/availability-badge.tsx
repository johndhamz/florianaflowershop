import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { type Availability, AVAILABILITY_LABELS } from "@/modules/catalog/types";

const tone: Record<Availability, StatusTone> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "neutral",
  untracked: "info",
};

export function AvailabilityBadge({
  availability,
  quantity,
}: {
  availability: Availability;
  quantity?: number | null;
}) {
  const label =
    availability === "low_stock" && quantity
      ? `Only ${quantity} left`
      : AVAILABILITY_LABELS[availability];
  return (
    <StatusBadge tone={tone[availability]} dot={availability !== "out_of_stock"}>
      {label}
    </StatusBadge>
  );
}
