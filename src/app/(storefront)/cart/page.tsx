import type { Metadata } from "next";
import { Suspense } from "react";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CartView } from "@/components/storefront/cart-view";
import { getCart } from "@/modules/cart/queries";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

async function CartContents() {
  const cart = await getCart();
  return <CartView cart={cart} />;
}

export default function CartPage() {
  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Cart"
        title="Your cart"
        description="Prices are checked against the shop every time you open this page."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <CartContents />
      </Suspense>
    </Container>
  );
}
