import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCart } from "@/modules/cart/queries";
import { getBusinessSettings } from "@/modules/content/queries";
import { listDeliveryZones } from "@/modules/delivery/queries";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function CheckoutContents() {
  const [cart, zones, settings] = await Promise.all([
    getCart(),
    listDeliveryZones(),
    getBusinessSettings(),
  ]);
  if (cart.items.length === 0) redirect("/cart");
  if (cart.has_issues) redirect("/cart");
  return (
    <CheckoutForm
      cart={cart}
      zones={zones.map((z) => ({
        id: z.id,
        name: z.name,
        city: z.city,
        barangays: z.barangays,
        feeCentavos: z.feeCentavos,
        freeDeliveryThresholdCentavos: z.freeDeliveryThresholdCentavos,
        minOrderCentavos: z.minOrderCentavos,
        sameDayCutoff: z.sameDayCutoff,
      }))}
      paymentMethods={{
        paymongo: settings.online_payments_enabled,
        bank_transfer: settings.bank_transfer_enabled,
      }}
    />
  );
}

export default function CheckoutPage() {
  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Checkout"
        title="Almost there"
        description="Guest checkout. We only ask for what we need to deliver."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <CheckoutContents />
      </Suspense>
    </Container>
  );
}
