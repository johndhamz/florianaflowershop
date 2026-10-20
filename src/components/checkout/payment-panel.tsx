"use client";

import { CreditCardIcon, Loader2Icon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatManila } from "@/lib/datetime";
import { formatCentavos } from "@/lib/money";
import { startPaymentRetry, uploadPaymentProof } from "@/modules/checkout/actions";
import type { TrackedOrder } from "@/modules/orders/tracking";

export function PaymentPanel({ order, token }: { order: TrackedOrder; token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const latest = order.payments[0];

  if (order.payment_status === "paid") {
    return (
      <section
        aria-label="Payment"
        className="rounded-2xl border border-success/30 bg-success/10 p-5 text-sm"
      >
        <p className="font-medium">
          Paid {latest?.paid_at ? formatManila(latest.paid_at) : ""} ·{" "}
          {formatCentavos(order.total_centavos)}
        </p>
        <p className="mt-1 text-muted-foreground">
          We&apos;ll message the recipient 30 minutes before the rider arrives.
        </p>
      </section>
    );
  }

  if (!order.can_pay) {
    return (
      <section aria-label="Payment" className="rounded-2xl bg-muted/60 p-5 text-sm">
        <p className="font-medium">This order is no longer payable.</p>
        <p className="mt-1 text-muted-foreground">
          {order.cancellation_reason === "payment_timeout"
            ? "The payment window passed and the flowers were released back to stock. Place a new order any time."
            : "Contact us if you think this is a mistake."}
        </p>
        <Button className="mt-3" variant="outline" asChild>
          <Link href="/shop">Shop again</Link>
        </Button>
      </section>
    );
  }

  const bank = order.payment_method === "bank_transfer";
  const awaitingVerification = bank && latest?.status === "requires_action";

  const retry = () =>
    startTransition(async () => {
      setError(null);
      const res = await startPaymentRetry(order.order_number, token);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.assign(res.url);
    });

  return (
    <section
      aria-label="Payment"
      className="rounded-2xl border border-warning/30 bg-warning/10 p-5 text-sm"
    >
      {bank ? (
        <>
          <h2 className="font-serif text-xl font-semibold">
            {awaitingVerification
              ? "Proof received — we're verifying it"
              : "Complete your bank transfer"}
          </h2>
          <p className="mt-1 text-muted-foreground">
            Amount due:{" "}
            <span className="font-medium text-foreground">
              {formatCentavos(order.total_centavos)}
            </span>
            {order.reservation_expires_at ? (
              <>
                {" "}
                · we hold your flowers until {formatManila(order.reservation_expires_at)}
              </>
            ) : null}
          </p>
          {order.bank_transfer_instructions ? (
            <p className="mt-3 rounded-lg bg-card p-3 whitespace-pre-line">
              {order.bank_transfer_instructions}
            </p>
          ) : null}
          {awaitingVerification ? (
            <p className="mt-3">
              Uploaded{" "}
              {latest?.proof_uploaded_at ? formatManila(latest.proof_uploaded_at) : ""}.
              We confirm within 2 hours during shop hours.
            </p>
          ) : (
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                data.set("order", order.order_number);
                data.set("t", token);
                startTransition(async () => {
                  setError(null);
                  const res = await uploadPaymentProof(data);
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  toast.success("Proof uploaded. We'll verify it shortly.");
                  router.refresh();
                });
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="proof-reference">Transfer reference (optional)</Label>
                <Input
                  id="proof-reference"
                  name="reference"
                  placeholder="e.g. GCash ref no."
                  className="h-10 bg-card"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="proof-file">Screenshot or PDF of the transfer</Label>
                <Input
                  id="proof-file"
                  name="proof"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  required
                  className="h-10 bg-card file:mr-2"
                />
              </div>
              <Button type="submit" disabled={pending} className="self-start">
                {pending ? (
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <UploadIcon data-icon="inline-start" />
                )}
                Upload proof
              </Button>
            </form>
          )}
        </>
      ) : (
        <>
          <h2 className="font-serif text-xl font-semibold">
            {latest?.status === "failed"
              ? "Payment didn't go through"
              : "Payment pending"}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {latest?.status === "failed" && latest.failure_message
              ? `${latest.failure_message} `
              : ""}
            Amount due {formatCentavos(order.total_centavos)}
            {order.reservation_expires_at ? (
              <> · reserved until {formatManila(order.reservation_expires_at)}</>
            ) : null}
          </p>
          <Button className="mt-4" onClick={retry} disabled={pending}>
            {pending ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <CreditCardIcon data-icon="inline-start" />
            )}
            {latest?.status === "failed" ? "Try paying again" : "Pay now"}
          </Button>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
