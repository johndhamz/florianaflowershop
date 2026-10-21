"use client";

import { AlertTriangleIcon, CalendarIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignRider,
  authorizeRetry,
  rescheduleDelivery,
} from "@/modules/delivery/admin-actions";
import type { BoardRow } from "@/modules/delivery/admin-queries";

const tone: Record<string, StatusTone> = {
  pending: "neutral",
  scheduled: "info",
  out_for_delivery: "warning",
  delivered: "success",
  failed: "danger",
  cancelled: "neutral",
};
const prepTone: Record<string, StatusTone> = {
  unfulfilled: "neutral",
  preparing: "warning",
  ready: "success",
  fulfilled: "success",
};

export function DispatchBoard({
  rows,
  riders,
  slots,
  date,
  canDispatch,
}: {
  rows: BoardRow[];
  riders: { id: string; name: string }[];
  slots: { id: string; label: string }[];
  date: string | null;
  canDispatch: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reschedule, setReschedule] = useState<BoardRow | null>(null);

  const act = (
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
    then?: () => void,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Done");
      then?.();
      router.refresh();
    });

  const counts = rows.reduce<Record<string, number>>(
    (acc, r) => ((acc[r.delivery_status] = (acc[r.delivery_status] ?? 0) + 1), acc),
    {},
  );

  const columns: DataTableColumn<BoardRow>[] = [
    {
      id: "order",
      header: "Order",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {r.slot_label ?? "—"}
            {date ? "" : ` · ${r.delivery_date}`}
          </p>
        </div>
      ),
    },
    {
      id: "to",
      header: "Deliver to",
      cell: (r) => (
        <div>
          <p>{r.recipient_name}</p>
          <p className="text-xs text-muted-foreground">
            {r.address_line1 ? `${r.address_line1}, ` : ""}
            {r.barangay}, {r.city}
          </p>
          {r.delivery_instructions ? (
            <p className="text-xs text-muted-foreground">“{r.delivery_instructions}”</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "prep",
      header: "Prep",
      hideBelow: "md",
      cell: (r) => (
        <StatusBadge tone={prepTone[r.fulfillment_status] ?? "neutral"} dot={false}>
          {r.fulfillment_status}
        </StatusBadge>
      ),
    },
    {
      id: "status",
      header: "Delivery",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={tone[r.delivery_status] ?? "neutral"}>
            {r.delivery_status.replaceAll("_", " ")}
          </StatusBadge>
          {r.exception ? (
            <StatusBadge tone="danger" dot={false}>
              <AlertTriangleIcon aria-hidden className="size-3" />
              {r.exception.replaceAll("_", " ")}
            </StatusBadge>
          ) : null}
          {r.delivery_attempts > 1 ? (
            <span className="text-xs text-muted-foreground">×{r.delivery_attempts}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "rider",
      header: "Rider",
      cell: (r) =>
        canDispatch && !["delivered", "cancelled"].includes(r.delivery_status) ? (
          <select
            aria-label={`Rider for ${r.order_number}`}
            value={r.assigned_rider_id ?? ""}
            disabled={pending || r.delivery_status === "out_for_delivery"}
            onChange={(e) => act(() => assignRider(r.order_id, e.target.value || null))}
            className="h-8 rounded-lg border border-input bg-card px-2 text-sm"
          >
            <option value="">Unassigned</option>
            {riders.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        ) : (
          <span>{r.rider_name ?? "—"}</span>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        canDispatch ? (
          <div className="flex justify-end gap-1">
            {r.delivery_status === "failed" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  act(() => authorizeRetry(r.order_id, "Retry authorized from board"))
                }
                aria-label={`Authorize retry ${r.order_number}`}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Retry
              </Button>
            ) : null}
            {!["delivered", "cancelled", "out_for_delivery"].includes(
              r.delivery_status,
            ) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setReschedule(r)}
                aria-label={`Reschedule ${r.order_number}`}
              >
                <CalendarIcon data-icon="inline-start" />
                Reschedule
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex items-center gap-2">
          <Label htmlFor="board-date" className="sr-only">
            Date
          </Label>
          <Input
            id="board-date"
            name="date"
            type="date"
            defaultValue={date ?? ""}
            className="h-9 w-44 bg-card"
          />
          <Button type="submit" variant="outline" size="sm">
            Go
          </Button>
        </form>
        <Button variant={date ? "ghost" : "outline"} size="sm" asChild>
          <Link href="/admin/dispatch?date=all">All open</Link>
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          {rows.length} deliveries
          {Object.entries(counts).map(([k, v]) => ` · ${k.replaceAll("_", " ")} ${v}`)}
        </p>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.order_id}
        caption="Dispatch board"
      />

      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (!reschedule) return;
              act(
                () =>
                  rescheduleDelivery({
                    orderId: reschedule.order_id,
                    date: String(fd.get("date")),
                    slotId: String(fd.get("slot")),
                    note: String(fd.get("note") ?? ""),
                  }),
                () => setReschedule(null),
              );
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Reschedule {reschedule?.order_number}</DialogTitle>
              <DialogDescription>
                Moves the delivery to a new date and slot with capacity. The customer is
                not charged.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-date">New date</Label>
              <Input
                id="rs-date"
                name="date"
                type="date"
                required
                defaultValue={reschedule?.delivery_date}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-slot">Slot</Label>
              <select
                id="rs-slot"
                name="slot"
                required
                className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
              >
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-note">Note</Label>
              <Input id="rs-note" name="note" maxLength={300} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setReschedule(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Reschedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
