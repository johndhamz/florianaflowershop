import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/server";
import { getTrackedOrder } from "@/modules/orders/tracking";
import { getPaymentProvider } from "@/modules/payments/provider";
import { reconcilePayment } from "@/modules/payments/webhook";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

/**
 * Landing page after the hosted checkout. The webhook is the source of truth,
 * but a customer returning before it lands shouldn't see "unpaid": we ask the
 * provider directly and apply the same idempotent transition.
 */
async function Confirm({
  searchParams,
}: {
  searchParams: PageProps<"/checkout/confirmation">["searchParams"];
}) {
  const sp = await searchParams;
  const orderNumber = typeof sp.order === "string" ? sp.order : "";
  const token = typeof sp.t === "string" ? sp.t : "";
  const order = await getTrackedOrder(orderNumber, token);
  if (!order) redirect("/");

  const pending = order.payments.find(
    (p) =>
      p.provider !== "bank_transfer" && ["pending", "requires_action"].includes(p.status),
  );
  if (pending && order.payment_status !== "paid") {
    const { data } = await createAdminClient()
      .from("payments")
      .select("id, provider_payment_id, status")
      .eq("id", pending.id)
      .single();
    if (data)
      await reconcilePayment(getPaymentProvider(), data).catch((e) =>
        console.error("reconcile failed", e),
      );
  }
  redirect(`/orders/${orderNumber}?t=${token}&placed=1`);
  return null;
}

export default function ConfirmationPage({
  searchParams,
}: PageProps<"/checkout/confirmation">) {
  return (
    <Container className="py-16">
      <Suspense
        fallback={<Skeleton className="mx-auto h-40 w-full max-w-xl rounded-2xl" />}
      >
        <Confirm searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
