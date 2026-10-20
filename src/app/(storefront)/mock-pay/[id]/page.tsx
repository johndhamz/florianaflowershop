import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MockPayButtons } from "@/components/checkout/mock-pay-buttons";
import { Container } from "@/components/shared/container";
import { getServerEnv } from "@/lib/env";
import { formatCentavos } from "@/lib/money";
import { getMockSession } from "@/modules/payments/providers/mock";

export const metadata: Metadata = { title: "Mock payment", robots: { index: false } };

/** Stand-in for PayMongo's hosted checkout + test authorize page. Dev/E2E only. */
export default async function MockPayPage({ params }: PageProps<"/mock-pay/[id]">) {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "mock") notFound();
  const { id } = await params;
  const session = getMockSession(id);
  if (!session) notFound();

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Mock gateway · test mode
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold">
          Pay {formatCentavos(session.amount)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order {session.orderNumber}. This page imitates PayMongo&apos;s hosted checkout
          and its test e-wallet page.
        </p>
        {session.paymentStatus === "paid" ? (
          <p className="mt-4 text-sm text-success">Already paid.</p>
        ) : session.status === "expired" ? (
          <p className="mt-4 text-sm text-destructive">This session has expired.</p>
        ) : (
          <MockPayButtons
            sessionId={id}
            successUrl={session.successUrl}
            cancelUrl={session.cancelUrl}
          />
        )}
      </div>
    </Container>
  );
}
