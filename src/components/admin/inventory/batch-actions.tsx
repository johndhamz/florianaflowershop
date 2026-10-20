"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { adjustStock, recordWastage } from "@/modules/inventory/actions";

type Batch = {
  id: string;
  code: string;
  remaining: number;
  reserved: number;
  unit: string;
};

export function BatchActions({ batch, canAdjust }: { batch: Batch; canAdjust: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"wastage" | "adjust" | null>(null);
  const [pending, startTransition] = useTransition();
  const available = batch.remaining - batch.reserved;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        mode === "wastage"
          ? await recordWastage({
              batch_id: batch.id,
              quantity: Number(data.get("quantity")),
              reason: String(data.get("reason")) as "damaged",
              note: String(data.get("note") ?? ""),
            })
          : await adjustStock(
              batch.id,
              Number(data.get("delta")),
              String(data.get("reason") ?? ""),
            );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setMode(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setMode("wastage")}
          aria-label={`Record wastage for ${batch.code}`}
        >
          Wastage
        </Button>
        {canAdjust ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMode("adjust")}
            aria-label={`Adjust ${batch.code}`}
          >
            Adjust
          </Button>
        ) : null}
      </div>
      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {mode === "wastage" ? "Record wastage" : "Adjust count"} · {batch.code}
              </DialogTitle>
              <DialogDescription>
                {batch.remaining} {batch.unit} remaining, {batch.reserved} reserved →{" "}
                {available} available. Reserved stock is protected.
              </DialogDescription>
            </DialogHeader>
            {mode === "wastage" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="w-qty">Quantity wasted</Label>
                  <Input
                    id="w-qty"
                    name="quantity"
                    type="number"
                    min={0.001}
                    step="any"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="w-reason">Reason</Label>
                  <select
                    id="w-reason"
                    name="reason"
                    className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
                    defaultValue="damaged"
                  >
                    <option value="damaged">Damaged</option>
                    <option value="wilted">Wilted</option>
                    <option value="expired">Expired</option>
                    <option value="lost">Lost</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="w-note">Note</Label>
                  <Input id="w-note" name="note" maxLength={300} />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-delta">Adjustment (+ / −)</Label>
                  <Input
                    id="a-delta"
                    name="delta"
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. -2 or 5"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-reason">Reason (required)</Label>
                  <Input
                    id="a-reason"
                    name="reason"
                    minLength={3}
                    maxLength={200}
                    required
                  />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
