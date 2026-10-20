"use client";

import {
  CameraIcon,
  CheckCircle2Icon,
  GiftIcon,
  LeafIcon,
  MessageSquareTextIcon,
  PlayIcon,
  RepeatIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Qty, unitLabel } from "@/components/admin/inventory/qty";
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
import { Textarea } from "@/components/ui/textarea";
import { formatManila } from "@/lib/datetime";
import {
  applySubstitution,
  completePreparation,
  startPreparation,
  uploadArrangementPhoto,
} from "@/modules/preparation/actions";
import type { PreparationDetails } from "@/modules/preparation/queries";

type Material = { id: string; name: string; unit: string; category: string };
const tone: Record<string, StatusTone> = {
  unfulfilled: "neutral",
  preparing: "warning",
  ready: "success",
  fulfilled: "success",
  cancelled: "danger",
};

export function PrepWorkspace({
  details,
  photoUrl,
  materials,
  isAdmin,
}: {
  details: PreparationDetails;
  photoUrl: string | null;
  materials: Material[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { order } = details;
  const editable =
    ["unfulfilled", "preparing"].includes(order.fulfillment_status) &&
    order.status === "confirmed";

  // Planned totals per material from recipes (required lines) + reservations as the default actuals.
  const planned = new Map<
    string,
    { material_id: string; name: string; unit: string; total: number }
  >();
  for (const item of details.items)
    for (const line of item.recipe?.lines ?? []) {
      if (line.is_optional) continue;
      const prev = planned.get(line.material_id);
      planned.set(line.material_id, {
        material_id: line.material_id,
        name: line.name,
        unit: line.unit,
        total: (prev?.total ?? 0) + line.total,
      });
    }
  for (const r of details.reservations.filter((x) => x.status === "active")) {
    if (!planned.has(r.material_id))
      planned.set(r.material_id, {
        material_id: r.material_id,
        name: r.material,
        unit: r.unit,
        total: 0,
      });
  }
  const reservedBy = new Map<string, number>();
  for (const r of details.reservations.filter((x) => x.status === "active"))
    reservedBy.set(r.material_id, (reservedBy.get(r.material_id) ?? 0) + r.quantity);

  const [actual, setActual] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...planned.values()].map((p) => [
        p.material_id,
        String(reservedBy.get(p.material_id) ?? p.total),
      ]),
    ),
  );
  const [extras, setExtras] = useState<{ material_id: string; quantity: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(order.arrangement_photo_path);
  const [subOpen, setSubOpen] = useState(false);

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

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("orderId", order.order_id);
    fd.set("photo", file);
    startTransition(async () => {
      const res = await uploadArrangementPhoto(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPhotoPath(res.data!.path);
      toast.success("Photo uploaded.");
    });
  };

  const complete = () => {
    const lines = [
      ...Object.entries(actual).map(([material_id, q]) => ({
        material_id,
        quantity: Number(q || 0),
      })),
      ...extras
        .filter((x) => x.material_id && Number(x.quantity) > 0)
        .map((x) => ({ material_id: x.material_id, quantity: Number(x.quantity) })),
    ];
    act(
      () => completePreparation({ orderId: order.order_id, lines, notes, photoPath }),
      () => router.push("/admin/prep"),
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="flex flex-col gap-6">
        <header className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-sans text-xl font-semibold">{order.order_number}</h1>
              <p className="text-sm text-muted-foreground">
                {order.delivery_date
                  ? formatManila(`${order.delivery_date}T00:00:00+08:00`, {
                      dateStyle: "full",
                    })
                  : ""}
                {order.slot_label ? ` · ${order.slot_label}` : ""}
                {order.recipient_name ? ` · for ${order.recipient_name}` : ""}
                {order.barangay ? ` (${order.barangay})` : ""}
              </p>
            </div>
            <div className="flex gap-1.5">
              {order.needs_attention ? (
                <StatusBadge tone="danger" dot={false}>
                  Needs attention
                </StatusBadge>
              ) : null}
              <StatusBadge tone={tone[order.fulfillment_status] ?? "neutral"}>
                {order.fulfillment_status}
              </StatusBadge>
            </div>
          </div>
          {order.gift_message ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-blush-100/70 p-3 text-sm">
              <GiftIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-blush-700" />
              <span>
                <span className="block text-xs font-medium tracking-wide text-blush-700 uppercase">
                  Card message
                </span>
                <span className="font-serif text-base italic">
                  “{order.gift_message}”
                </span>
              </span>
            </p>
          ) : null}
          {order.delivery_instructions ? (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-accent/70 p-3 text-sm">
              <MessageSquareTextIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-sage-700"
              />
              <span>
                <span className="block text-xs font-medium tracking-wide text-sage-700 uppercase">
                  Special instructions
                </span>
                {order.delivery_instructions}
              </span>
            </p>
          ) : null}
          {order.internal_notes ? (
            <p className="mt-2 text-xs whitespace-pre-line text-muted-foreground">
              {order.internal_notes}
            </p>
          ) : null}
          {editable && order.fulfillment_status === "unfulfilled" ? (
            <Button
              className="mt-4 h-11 w-full sm:w-auto"
              size="lg"
              disabled={pending}
              onClick={() => act(() => startPreparation(order.order_id))}
            >
              <PlayIcon data-icon="inline-start" />
              Start preparation
            </Button>
          ) : null}
        </header>

        {details.items.map((item) => (
          <section
            key={item.order_item_id}
            aria-label={`${item.product_name} recipe`}
            className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <h2 className="font-sans text-base font-semibold">
              {item.quantity} × {item.product_name}{" "}
              <span className="font-normal text-muted-foreground">
                · {item.variant_name}
              </span>
            </h2>
            {item.add_ons.length ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Add-ons:{" "}
                {item.add_ons
                  .map((a) => `${a.name}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`)
                  .join(", ")}
              </p>
            ) : null}
            {item.recipe ? (
              <>
                {item.recipe.instructions ? (
                  <p className="mt-3 flex items-start gap-2 text-sm">
                    <LeafIcon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-sage-600"
                    />
                    {item.recipe.instructions}
                  </p>
                ) : null}
                <table className="mt-3 w-full text-sm">
                  <caption className="sr-only">Recipe for {item.product_name}</caption>
                  <thead className="text-left text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="py-1 font-medium">Material</th>
                      <th className="py-1 text-right font-medium">Per unit</th>
                      <th className="py-1 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {item.recipe.lines.map((l) => (
                      <tr key={l.material_id}>
                        <td className="py-1.5">
                          {l.name}
                          {l.is_optional ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (optional)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5 text-right">
                          <Qty value={l.per_unit} unit={l.unit} />
                        </td>
                        <td className="py-1.5 text-right">
                          <Qty value={l.total} unit={l.unit} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {item.recipe.assembly_minutes ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    About {item.recipe.assembly_minutes} min to assemble.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-warning">
                No recipe on file for this variant.
              </p>
            )}
          </section>
        ))}

        {details.reservations.length ? (
          <section
            aria-label="Reserved stock"
            className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <h2 className="font-sans text-base font-semibold">Reserved for this order</h2>
            <ul className="mt-2 divide-y text-sm">
              {details.reservations.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-1.5">
                  <span>
                    {r.material}{" "}
                    <span className="text-muted-foreground">
                      · {r.batch_code}
                      {r.expires_at
                        ? ` · exp ${formatManila(r.expires_at, { dateStyle: "medium" })}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Qty value={r.quantity} unit={r.unit} />
                    <StatusBadge
                      tone={r.status === "consumed" ? "success" : "info"}
                      dot={false}
                    >
                      {r.status}
                    </StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {details.substitutions.length ? (
          <section
            aria-label="Substitutions"
            className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <h2 className="font-sans text-base font-semibold">Substitutions</h2>
            <ul className="mt-2 divide-y text-sm">
              {details.substitutions.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1.5">
                  <span>
                    {s.quantity} × {s.from} → {s.to}{" "}
                    <span className="text-muted-foreground">· {s.reason}</span>
                  </span>
                  <StatusBadge
                    tone={
                      s.status === "approved"
                        ? "success"
                        : s.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                    dot={false}
                  >
                    {s.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside
        className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-24"
        aria-label="Finish preparation"
      >
        <h2 className="font-sans text-base font-semibold">Actual materials used</h2>
        {!editable ? (
          <p className="text-sm text-muted-foreground">
            {order.fulfillment_status === "ready"
              ? `Marked ready ${order.ready_at ? formatManila(order.ready_at) : ""}.`
              : "This order is not in preparation."}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {[...planned.values()].map((p) => (
                <li
                  key={p.material_id}
                  className="grid grid-cols-[1fr_96px] items-center gap-2 text-sm"
                >
                  <label htmlFor={`act-${p.material_id}`}>
                    {p.name}
                    <span className="block text-xs text-muted-foreground">
                      planned{" "}
                      <Qty
                        value={reservedBy.get(p.material_id) ?? p.total}
                        unit={p.unit}
                      />
                    </span>
                  </label>
                  <Input
                    id={`act-${p.material_id}`}
                    type="number"
                    step="any"
                    min={0}
                    value={actual[p.material_id] ?? ""}
                    onChange={(e) =>
                      setActual((a) => ({ ...a, [p.material_id]: e.target.value }))
                    }
                    className="h-9 bg-background text-right"
                  />
                </li>
              ))}
              {extras.map((x, i) => (
                <li
                  key={`x-${i}`}
                  className="grid grid-cols-[1fr_96px] items-center gap-2 text-sm"
                >
                  <select
                    aria-label={`Extra material ${i + 1}`}
                    value={x.material_id}
                    onChange={(e) =>
                      setExtras((xs) =>
                        xs.map((y, j) =>
                          j === i ? { ...y, material_id: e.target.value } : y,
                        ),
                      )
                    }
                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Extra material…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({unitLabel(m.unit)})
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Extra quantity ${i + 1}`}
                    type="number"
                    step="any"
                    min={0}
                    value={x.quantity}
                    onChange={(e) =>
                      setExtras((xs) =>
                        xs.map((y, j) =>
                          j === i ? { ...y, quantity: e.target.value } : y,
                        ),
                      )
                    }
                    className="h-9 bg-background text-right"
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setExtras((xs) => [...xs, { material_id: "", quantity: "1" }])
                }
              >
                Add extra material
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSubOpen(true)}
              >
                <RepeatIcon data-icon="inline-start" />
                Substitute
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prep-photo" className="flex items-center gap-1">
                <CameraIcon aria-hidden className="size-4" />
                Arrangement photo (optional)
              </Label>
              <Input
                id="prep-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={onPhoto}
                className="h-10 bg-background file:mr-2"
              />
              {photoPath ? <p className="text-xs text-success">Photo attached.</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prep-notes">Notes</Label>
              <Textarea
                id="prep-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background"
              />
            </div>
            <Button size="lg" className="h-11" disabled={pending} onClick={complete}>
              <CheckCircle2Icon data-icon="inline-start" />
              Mark ready for dispatch
            </Button>
            <p className="text-xs text-muted-foreground">
              Unused reserved stock goes back to available; extras are taken from the
              earliest-expiring batches.
            </p>
          </>
        )}
        {photoUrl ? (
          <a
            href={photoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline underline-offset-4"
          >
            View current photo
          </a>
        ) : null}
        {isAdmin ? null : (
          <p className="text-[11px] text-muted-foreground">
            Substitutions you apply are reviewed by a manager.
          </p>
        )}
      </aside>

      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              act(
                () =>
                  applySubstitution({
                    orderId: order.order_id,
                    fromMaterialId: String(fd.get("from")),
                    toMaterialId: String(fd.get("to")),
                    quantity: Number(fd.get("quantity")),
                    reason: String(fd.get("reason")),
                  }),
                () => setSubOpen(false),
              );
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Substitute a material</DialogTitle>
              <DialogDescription>
                Releases part of the reserved material and reserves the substitute from
                the earliest-expiring stock.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-from">Replace</Label>
              <select
                id="sub-from"
                name="from"
                required
                className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {[...planned.values()]
                  .filter((p) => (reservedBy.get(p.material_id) ?? 0) > 0)
                  .map((p) => (
                    <option key={p.material_id} value={p.material_id}>
                      {p.name} (reserved {reservedBy.get(p.material_id)})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-to">With</Label>
              <select
                id="sub-to"
                name="to"
                required
                className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-qty">Quantity</Label>
              <Input
                id="sub-qty"
                name="quantity"
                type="number"
                step="any"
                min={0.001}
                required
                className="h-10 bg-background"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-reason">Reason</Label>
              <Input
                id="sub-reason"
                name="reason"
                required
                minLength={3}
                maxLength={300}
                className="h-10 bg-background"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSubOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Apply substitution
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
