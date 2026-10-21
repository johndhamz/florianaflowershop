"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCentavos } from "@/lib/money";
import {
  saveSameDayCutoff,
  saveSlot,
  saveZone,
  setSlotCapacity,
} from "@/modules/delivery/admin-actions";

type Zone = {
  id: string;
  slug: string;
  name: string;
  city: string;
  province: string;
  barangays: string[];
  fee_centavos: number;
  free_delivery_threshold_centavos: number | null;
  min_order_centavos: number;
  same_day_cutoff: string | null;
  lead_time_hours: number;
  is_active: boolean;
  position: number;
};
type Slot = {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  days_of_week: number[];
  default_capacity: number;
  is_active: boolean;
  position: number;
};
type Allocation = {
  id: string;
  slot_id: string;
  slot_label: string;
  delivery_date: string;
  capacity: number;
  booked: number;
  is_blocked: boolean;
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DeliverySettings({
  zones,
  slots,
  allocations,
  defaultCutoff,
}: {
  zones: Zone[];
  slots: Slot[];
  allocations: Allocation[];
  defaultCutoff: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [zone, setZone] = useState<Zone | "new" | null>(null);
  const [slot, setSlot] = useState<Slot | "new" | null>(null);

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
      toast.success(res.message ?? "Saved");
      then?.();
      router.refresh();
    });

  const zoneColumns: DataTableColumn<Zone>[] = [
    {
      id: "name",
      header: "Zone",
      cell: (z) => (
        <div>
          <p className="font-medium">{z.name}</p>
          <p className="text-xs text-muted-foreground">
            {z.barangays.length} barangays · {z.city}
          </p>
        </div>
      ),
    },
    {
      id: "fee",
      header: "Fee",
      align: "right",
      cell: (z) => <span className="tabular-nums">{formatCentavos(z.fee_centavos)}</span>,
    },
    {
      id: "free",
      header: "Free over",
      align: "right",
      hideBelow: "sm",
      cell: (z) =>
        z.free_delivery_threshold_centavos
          ? formatCentavos(z.free_delivery_threshold_centavos)
          : "—",
    },
    {
      id: "cutoff",
      header: "Same-day cutoff",
      hideBelow: "md",
      cell: (z) => z.same_day_cutoff ?? `None · ${z.lead_time_hours}h lead`,
    },
    {
      id: "status",
      header: "Status",
      cell: (z) =>
        z.is_active ? (
          <StatusBadge tone="success">Active</StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot={false}>
            Inactive
          </StatusBadge>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (z) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setZone(z)}
          aria-label={`Edit ${z.name}`}
        >
          Edit
        </Button>
      ),
    },
  ];
  const slotColumns: DataTableColumn<Slot>[] = [
    {
      id: "label",
      header: "Slot",
      cell: (s) => <span className="font-medium">{s.label}</span>,
    },
    { id: "window", header: "Window", cell: (s) => `${s.starts_at} – ${s.ends_at}` },
    {
      id: "days",
      header: "Days",
      hideBelow: "sm",
      cell: (s) => s.days_of_week.map((d) => DAYS[d]).join(" "),
    },
    { id: "cap", header: "Capacity", align: "right", cell: (s) => s.default_capacity },
    {
      id: "status",
      header: "Status",
      cell: (s) =>
        s.is_active ? (
          <StatusBadge tone="success">Active</StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot={false}>
            Inactive
          </StatusBadge>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (s) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSlot(s)}
          aria-label={`Edit ${s.label}`}
        >
          Edit
        </Button>
      ),
    },
  ];
  const allocColumns: DataTableColumn<Allocation>[] = [
    { id: "date", header: "Date", cell: (a) => a.delivery_date },
    { id: "slot", header: "Slot", cell: (a) => a.slot_label },
    {
      id: "booked",
      header: "Booked / capacity",
      align: "right",
      cell: (a) => (
        <span className="tabular-nums">
          {a.booked} / {a.capacity}
        </span>
      ),
    },
    {
      id: "blocked",
      header: "Blocked",
      cell: (a) =>
        a.is_blocked ? (
          <StatusBadge tone="danger" dot={false}>
            Blocked
          </StatusBadge>
        ) : (
          "—"
        ),
    },
  ];

  const zoneSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const z = zone === "new" ? null : zone;
    act(
      () =>
        saveZone({
          id: z?.id,
          slug: String(fd.get("slug")),
          name: String(fd.get("name")),
          city: String(fd.get("city")),
          province: String(fd.get("province") || "Cebu"),
          barangays: String(fd.get("barangays"))
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
          fee_pesos: Number(fd.get("fee")),
          free_delivery_threshold_pesos: fd.get("free") ? Number(fd.get("free")) : null,
          min_order_pesos: Number(fd.get("min") || 0),
          same_day_cutoff: fd.get("cutoff") ? String(fd.get("cutoff")) : null,
          lead_time_hours: Number(fd.get("lead") || 0),
          is_active: fd.get("active") === "on",
          position: Number(fd.get("position") || 0),
        }),
      () => setZone(null),
    );
  };
  const slotSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = slot === "new" ? null : slot;
    act(
      () =>
        saveSlot({
          id: s?.id,
          label: String(fd.get("label")),
          starts_at: String(fd.get("starts")),
          ends_at: String(fd.get("ends")),
          days_of_week: fd.getAll("days").map(Number),
          default_capacity: Number(fd.get("capacity")),
          is_active: fd.get("active") === "on",
          position: Number(fd.get("position") || 0),
        }),
      () => setSlot(null),
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="cutoff-h">
        <h2 id="cutoff-h" className="font-sans text-base font-semibold">
          Default same-day cutoff
        </h2>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            act(() => saveSameDayCutoff(String(fd.get("cutoff"))));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cutoff">Cutoff (Asia/Manila)</Label>
            <Input
              id="cutoff"
              name="cutoff"
              type="time"
              defaultValue={defaultCutoff}
              className="h-9 w-36 bg-card"
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Save
          </Button>
          <p className="text-xs text-muted-foreground">
            Zones can override with their own cutoff or disable same-day.
          </p>
        </form>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="zones-h">
        <div className="flex items-center justify-between">
          <h2 id="zones-h" className="font-sans text-base font-semibold">
            Zones
          </h2>
          <Button size="sm" onClick={() => setZone("new")}>
            <PlusIcon data-icon="inline-start" />
            New zone
          </Button>
        </div>
        <DataTable
          columns={zoneColumns}
          rows={zones}
          getRowId={(z) => z.id}
          caption="Delivery zones"
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="slots-h">
        <div className="flex items-center justify-between">
          <h2 id="slots-h" className="font-sans text-base font-semibold">
            Slot templates
          </h2>
          <Button size="sm" onClick={() => setSlot("new")}>
            <PlusIcon data-icon="inline-start" />
            New slot
          </Button>
        </div>
        <DataTable
          columns={slotColumns}
          rows={slots}
          getRowId={(s) => s.id}
          caption="Delivery slots"
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="cap-h">
        <h2 id="cap-h" className="font-sans text-base font-semibold">
          Capacity overrides (next 14 days)
        </h2>
        <form
          className="flex flex-wrap items-end gap-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            act(() =>
              setSlotCapacity({
                slotId: String(fd.get("slot")),
                date: String(fd.get("date")),
                capacity: Number(fd.get("capacity")),
                blocked: fd.get("blocked") === "on",
              }),
            );
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cap-date">Date</Label>
            <Input
              id="cap-date"
              name="date"
              type="date"
              required
              className="h-9 bg-background"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cap-slot">Slot</Label>
            <select
              id="cap-slot"
              name="slot"
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cap-n">Capacity</Label>
            <Input
              id="cap-n"
              name="capacity"
              type="number"
              min={0}
              required
              className="h-9 w-24 bg-background"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="blocked" /> Block
          </label>
          <Button type="submit" variant="outline" disabled={pending}>
            Apply
          </Button>
        </form>
        <DataTable
          columns={allocColumns}
          rows={allocations}
          getRowId={(a) => a.id}
          caption="Capacity overrides"
          emptyState={
            <p className="text-sm text-muted-foreground">
              No bookings or overrides in the next 14 days.
            </p>
          }
        />
      </section>

      <Dialog open={zone !== null} onOpenChange={(o) => !o && setZone(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={zoneSubmit} className="flex flex-col gap-3">
            <DialogHeader>
              <DialogTitle>
                {zone === "new" ? "New zone" : `Edit ${zone?.name ?? ""}`}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-name">Name</Label>
                <Input
                  id="z-name"
                  name="name"
                  required
                  defaultValue={zone !== "new" ? zone?.name : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-slug">Slug</Label>
                <Input
                  id="z-slug"
                  name="slug"
                  required
                  defaultValue={zone !== "new" ? zone?.slug : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-city">City</Label>
                <Input
                  id="z-city"
                  name="city"
                  required
                  defaultValue={zone !== "new" ? zone?.city : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-province">Province</Label>
                <Input
                  id="z-province"
                  name="province"
                  defaultValue={zone !== "new" ? zone?.province : "Cebu"}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="z-brgy">
                  Barangays (one per line or comma-separated)
                </Label>
                <Textarea
                  id="z-brgy"
                  name="barangays"
                  rows={4}
                  required
                  defaultValue={zone !== "new" ? zone?.barangays.join("\n") : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-fee">Fee (₱)</Label>
                <Input
                  id="z-fee"
                  name="fee"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={zone !== "new" && zone ? zone.fee_centavos / 100 : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-free">Free delivery over (₱)</Label>
                <Input
                  id="z-free"
                  name="free"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={
                    zone !== "new" && zone?.free_delivery_threshold_centavos
                      ? zone.free_delivery_threshold_centavos / 100
                      : ""
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-min">Minimum order (₱)</Label>
                <Input
                  id="z-min"
                  name="min"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={
                    zone !== "new" && zone ? zone.min_order_centavos / 100 : 0
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-cutoff">Same-day cutoff (blank = none)</Label>
                <Input
                  id="z-cutoff"
                  name="cutoff"
                  type="time"
                  defaultValue={zone !== "new" ? (zone?.same_day_cutoff ?? "") : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-lead">Lead time (hours)</Label>
                <Input
                  id="z-lead"
                  name="lead"
                  type="number"
                  min={0}
                  defaultValue={zone !== "new" && zone ? zone.lead_time_hours : 24}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="z-pos">Position</Label>
                <Input
                  id="z-pos"
                  name="position"
                  type="number"
                  defaultValue={zone !== "new" && zone ? zone.position : zones.length + 1}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={zone === "new" ? true : zone?.is_active}
                />{" "}
                Active
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setZone(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save zone
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={slot !== null} onOpenChange={(o) => !o && setSlot(null)}>
        <DialogContent>
          <form onSubmit={slotSubmit} className="flex flex-col gap-3">
            <DialogHeader>
              <DialogTitle>
                {slot === "new" ? "New slot" : `Edit ${slot?.label ?? ""}`}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="s-label">Label</Label>
                <Input
                  id="s-label"
                  name="label"
                  required
                  defaultValue={slot !== "new" ? slot?.label : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-start">Starts</Label>
                <Input
                  id="s-start"
                  name="starts"
                  type="time"
                  required
                  defaultValue={slot !== "new" ? slot?.starts_at : "09:00"}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-end">Ends</Label>
                <Input
                  id="s-end"
                  name="ends"
                  type="time"
                  required
                  defaultValue={slot !== "new" ? slot?.ends_at : "12:00"}
                />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-sm">Days</legend>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d, i) => (
                    <label key={d} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        name="days"
                        value={i}
                        defaultChecked={
                          slot === "new"
                            ? i >= 1 && i <= 6
                            : slot?.days_of_week.includes(i)
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-cap">Default capacity</Label>
                <Input
                  id="s-cap"
                  name="capacity"
                  type="number"
                  min={0}
                  required
                  defaultValue={slot !== "new" && slot ? slot.default_capacity : 10}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-pos">Position</Label>
                <Input
                  id="s-pos"
                  name="position"
                  type="number"
                  defaultValue={slot !== "new" && slot ? slot.position : slots.length + 1}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={slot === "new" ? true : slot?.is_active}
                />{" "}
                Active
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSlot(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save slot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
