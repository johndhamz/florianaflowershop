import type { Metadata } from "next";
import { LockIcon } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/** Placeholder until the checkout phase ships. Keeps the cart CTA from dead-ending. */
export default function CheckoutPage() {
  return (
    <Container className="py-16">
      <EmptyState
        icon={LockIcon}
        title="Checkout is almost ready"
        description="Online checkout and payments are being finished. Your cart is saved on this device for 30 days."
        action={
          <>
            <Button asChild>
              <Link href="/cart">Back to cart</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Order by message</Link>
            </Button>
          </>
        }
      />
    </Container>
  );
}
