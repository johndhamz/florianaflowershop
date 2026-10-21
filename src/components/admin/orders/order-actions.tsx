"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelOrder, updateInternalNotes } from "@/modules/orders/admin-actions";

export function OrderActions({
  orderId,
  orderNumber,
  canCancel,
  canNotes,
  notes,
}: {
  orderId: string;
  orderNumber: string;
  canCancel: boolean;
  canNotes: boolean;
  notes: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState(notes);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="font-sans text-base">Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canNotes ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await updateInternalNotes({ orderId, notes: draft });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(res.message);
                router.refresh();
              });
            }}
          >
            <Label htmlFor="internal-notes">Internal notes</Label>
            <Textarea
              id="internal-notes"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Visible to staff only."
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={pending || draft === notes}
            >
              Save notes
            </Button>
          </form>
        ) : null}
        {canCancel ? (
          <Button
            variant="destructive"
            size="sm"
            className="self-start"
            onClick={() => setOpen(true)}
          >
            Cancel order
          </Button>
        ) : null}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await cancelOrder({ orderId, reason });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(res.message);
                setOpen(false);
                router.refresh();
              });
            }}
            className="flex flex-col gap-3"
          >
            <DialogHeader>
              <DialogTitle>Cancel {orderNumber}?</DialogTitle>
              <DialogDescription>
                Stock reservations and the delivery slot are released. Paid orders still
                need a refund from the Payments page.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={2}
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer request, duplicate order…"
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Keep order
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || reason.trim().length < 3}
              >
                Confirm cancellation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
