import {
  AlertTriangleIcon,
  ClockIcon,
  FlowerIcon,
  GiftIcon,
  MessageSquareTextIcon,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatManila } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { QueueItem } from "@/modules/preparation/queries";

const tone: Record<string, StatusTone> = {
  unfulfilled: "neutral",
  preparing: "warning",
  ready: "success",
};

function deadlineLabel(item: QueueItem) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(),
  );
  if (item.delivery_date === today) return { text: "Today", urgent: true };
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + 86_400_000),
  );
  if (item.delivery_date === tomorrow) return { text: "Tomorrow", urgent: false };
  if (item.delivery_date < today) return { text: "Overdue", urgent: true };
  return {
    text: formatManila(`${item.delivery_date}T00:00:00+08:00`, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    urgent: false,
  };
}

export function PrepQueue({
  items,
  includeReady,
}: {
  items: QueueItem[];
  includeReady: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length === 1 ? "1 order" : `${items.length} orders`}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={includeReady ? "/admin/prep" : "/admin/prep?ready=1"}>
            {includeReady ? "Hide ready" : "Show ready"}
          </Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={FlowerIcon}
          title="Nothing to prepare"
          description="Paid orders appear here, earliest delivery first."
        />
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Orders to prepare">
          {items.map((item) => {
            const deadline = deadlineLabel(item);
            return (
              <li key={item.order_id}>
                <Link
                  href={`/admin/prep/${item.order_id}`}
                  className={cn(
                    "block rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    item.fulfillment_status === "preparing" && "ring-warning/40",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-sans text-base font-semibold">
                        {item.order_number}
                      </p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <ClockIcon aria-hidden className="size-3.5" />
                        <span
                          className={
                            deadline.urgent ? "font-medium text-destructive" : undefined
                          }
                        >
                          {deadline.text}
                        </span>
                        {item.slot_label ? ` · ${item.slot_label}` : ""}
                        {item.zone_name ? ` · ${item.zone_name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.needs_attention ? (
                        <StatusBadge tone="danger" dot={false}>
                          <AlertTriangleIcon aria-hidden className="size-3" />
                          Attention
                        </StatusBadge>
                      ) : null}
                      <StatusBadge tone={tone[item.fulfillment_status] ?? "neutral"}>
                        {item.fulfillment_status}
                      </StatusBadge>
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1 text-sm">
                    {item.items.map((i, idx) => (
                      <li key={idx}>
                        <span className="font-medium">
                          {i.quantity} × {i.product_name}
                        </span>{" "}
                        <span className="text-muted-foreground">· {i.variant_name}</span>
                        {i.add_ons.length ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · +{" "}
                            {i.add_ons
                              .map(
                                (a) =>
                                  `${a.name}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`,
                              )
                              .join(", ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {item.gift_message ? (
                      <span className="inline-flex items-center gap-1">
                        <GiftIcon aria-hidden className="size-3" />
                        Card message
                      </span>
                    ) : null}
                    {item.delivery_instructions ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareTextIcon aria-hidden className="size-3" />
                        Instructions
                      </span>
                    ) : null}
                    {item.prepared_by_name ? (
                      <span>Florist: {item.prepared_by_name}</span>
                    ) : null}
                    {item.substitutions > 0 ? (
                      <span>
                        {item.substitutions} substitution
                        {item.substitutions > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
