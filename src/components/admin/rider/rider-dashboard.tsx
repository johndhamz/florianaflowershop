"use client";

import {
  CameraIcon,
  CheckCircle2Icon,
  MapPinIcon,
  NavigationIcon,
  PhoneIcon,
  TruckIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
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
import { cn } from "@/lib/utils";
import {
  completeDelivery,
  failDelivery,
  startDelivery,
  uploadProof,
} from "@/modules/delivery/admin-actions";
import type { RiderDelivery } from "@/modules/delivery/admin-queries";

const tone: Record<string, StatusTone> = {
  scheduled: "info",
  out_for_delivery: "warning",
  delivered: "success",
  failed: "danger",
  pending: "neutral",
};

export function RiderDashboard({
  deliveries,
  includeDone,
}: {
  deliveries: RiderDelivery[];
  includeDone: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<{
    kind: "deliver" | "fail";
    d: RiderDelivery;
  } | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(null);

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

  const onProof = (orderId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("photo", file);
    startTransition(async () => {
      const res = await uploadProof(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setProofPath(res.data!.path);
      toast.success("Photo attached.");
    });
  };

  const deliver = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modal || !proofPath) {
      toast.error("Take a proof-of-delivery photo first.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const d = modal.d;
    const finish = (coords?: GeolocationCoordinates) =>
      act(
        () =>
          completeDelivery({
            orderId: d.order_id,
            proofPath,
            receivedBy: String(fd.get("received_by") ?? ""),
            note: String(fd.get("note") ?? ""),
            latitude: coords?.latitude,
            longitude: coords?.longitude,
          }),
        () => {
          setModal(null);
          setProofPath(null);
        },
      );
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos.coords),
        () => finish(),
        { timeout: 3000 },
      );
    } else finish();
  };

  const fail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modal) return;
    const fd = new FormData(e.currentTarget);
    act(
      () =>
        failDelivery({
          orderId: modal.d.order_id,
          exception: String(fd.get("exception")) as "other",
          note: String(fd.get("note") ?? ""),
          photoPath: proofPath,
        }),
      () => {
        setModal(null);
        setProofPath(null);
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {deliveries.length === 1 ? "1 delivery" : `${deliveries.length} deliveries`}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={includeDone ? "/admin/rider" : "/admin/rider?done=1"}>
            {includeDone ? "Hide completed" : "Show completed"}
          </Link>
        </Button>
      </div>
      {deliveries.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          title="No deliveries assigned"
          description="When dispatch assigns you a delivery it appears here."
        />
      ) : (
        <ol className="flex flex-col gap-3" aria-label="My deliveries">
          {deliveries.map((d) => (
            <li
              key={d.order_id}
              className={cn(
                "rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
                d.delivery_status === "out_for_delivery" && "ring-warning/50",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-sans text-base font-semibold">{d.order_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.delivery_date} · {d.slot_label ?? ""}
                    {d.delivery_attempts > 1 ? ` · attempt ${d.delivery_attempts}` : ""}
                  </p>
                </div>
                <StatusBadge tone={tone[d.delivery_status] ?? "neutral"}>
                  {d.delivery_status.replaceAll("_", " ")}
                </StatusBadge>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <p className="font-medium">{d.recipient_name}</p>
                <p className="flex items-start gap-1.5">
                  <MapPinIcon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-sage-600"
                  />
                  <span>
                    {d.address}, {d.barangay}, {d.city}
                    {d.landmark ? (
                      <span className="block text-muted-foreground">
                        Landmark: {d.landmark}
                      </span>
                    ) : null}
                  </span>
                </p>
                {d.delivery_instructions ? (
                  <p className="rounded-lg bg-accent/70 p-2 text-xs">
                    “{d.delivery_instructions}”
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {d.items?.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}
                  {d.has_card ? " · with card" : ""}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {d.recipient_phone ? (
                  <Button variant="outline" size="lg" className="h-11" asChild>
                    <a href={`tel:${d.recipient_phone}`}>
                      <PhoneIcon data-icon="inline-start" />
                      Call
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" size="lg" className="h-11" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.address}, ${d.barangay}, ${d.city}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <NavigationIcon data-icon="inline-start" />
                    Navigate
                  </a>
                </Button>
                {d.delivery_status === "scheduled" ? (
                  <Button
                    size="lg"
                    className="col-span-2 h-11"
                    disabled={pending || d.fulfillment_status !== "ready"}
                    onClick={() => act(() => startDelivery(d.order_id))}
                    aria-label={`Start delivery ${d.order_number}`}
                  >
                    <TruckIcon data-icon="inline-start" />
                    {d.fulfillment_status === "ready"
                      ? "Start delivery"
                      : "Waiting for florist"}
                  </Button>
                ) : null}
                {d.delivery_status === "out_for_delivery" ? (
                  <>
                    <Button
                      size="lg"
                      className="h-11"
                      disabled={pending}
                      onClick={() => {
                        setProofPath(null);
                        setModal({ kind: "deliver", d });
                      }}
                      aria-label={`Mark delivered ${d.order_number}`}
                    >
                      <CheckCircle2Icon data-icon="inline-start" />
                      Delivered
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-11"
                      disabled={pending}
                      onClick={() => {
                        setProofPath(null);
                        setModal({ kind: "fail", d });
                      }}
                      aria-label={`Mark failed ${d.order_number}`}
                    >
                      <XCircleIcon data-icon="inline-start" />
                      Could not deliver
                    </Button>
                  </>
                ) : null}
                {d.delivery_status === "failed" ? (
                  <p className="col-span-2 text-xs text-destructive">
                    Failed attempt recorded. Wait for dispatch to authorize a retry or
                    reschedule.
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          {modal?.kind === "deliver" ? (
            <form onSubmit={deliver} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Delivered · {modal.d.order_number}</DialogTitle>
                <DialogDescription>
                  A proof-of-delivery photo is required.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pod-photo" className="flex items-center gap-1">
                  <CameraIcon aria-hidden className="size-4" />
                  Proof photo
                </Label>
                <Input
                  id="pod-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onProof(modal.d.order_id)}
                  className="h-10 file:mr-2"
                  required
                />
                {proofPath ? (
                  <p className="text-xs text-success">Photo attached.</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pod-received">Received by</Label>
                <Input
                  id="pod-received"
                  name="received_by"
                  placeholder="Name of the person who received"
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pod-note">Note</Label>
                <Textarea id="pod-note" name="note" rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || !proofPath}>
                  Confirm delivered
                </Button>
              </DialogFooter>
            </form>
          ) : modal?.kind === "fail" ? (
            <form onSubmit={fail} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Could not deliver · {modal.d.order_number}</DialogTitle>
                <DialogDescription>
                  Tell dispatch what happened. A manager must authorize a retry or
                  reschedule.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fail-exception">Reason</Label>
                <select
                  id="fail-exception"
                  name="exception"
                  className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
                  defaultValue="recipient_unavailable"
                >
                  <option value="recipient_unavailable">Recipient unavailable</option>
                  <option value="wrong_address">Wrong / incomplete address</option>
                  <option value="refused">Refused</option>
                  <option value="weather">Weather</option>
                  <option value="vehicle">Vehicle problem</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fail-note">What happened (required)</Label>
                <Textarea id="fail-note" name="note" rows={3} required minLength={5} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fail-photo">Photo (optional)</Label>
                <Input
                  id="fail-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onProof(modal.d.order_id)}
                  className="h-10 file:mr-2"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  Record failed attempt
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
