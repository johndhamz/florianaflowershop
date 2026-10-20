import type { Metadata } from "next";
import { CheckCircle2Icon, ClockIcon, SearchXIcon, XCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { PaymentPanel } from "@/components/checkout/payment-panel";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatManila } from "@/lib/datetime";
import { formatCentavos } from "@/lib/money";
import { productImageSrc } from "@/lib/supabase/storage";
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  type OrderStatus,
  type PaymentStatus,
} from "@/modules/orders";
import { getTrackedOrder } from "@/modules/orders/tracking";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

async function Tracking({
  params,
  searchParams,
}: {
  params: PageProps<"/orders/[number]">["params"];
  searchParams: PageProps<"/orders/[number]">["searchParams"];
}) {
  const { number } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const justPlaced = sp.placed === "1";
  const order = await getTrackedOrder(number, token);

  if (!order) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="We couldn't find that order"
        description="Check the link from your confirmation email. The tracking link includes a private code."
        action={
          <Button asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        }
      />
    );
  }

  const paid = order.payment_status === "paid";
  const cancelled = order.status === "cancelled";
  const headline = paid
    ? "Thank you! Your order is confirmed."
    : cancelled
      ? "This order was cancelled"
      : justPlaced
        ? "Your order is placed — one more step"
        : "Your order";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="flex flex-col gap-8">
        <header>
          <p className="text-xs font-medium tracking-[0.18em] text-sage-600 uppercase">
            Order {order.order_number}
          </p>
          <h1 className="mt-2 flex items-center gap-3 font-serif text-3xl font-semibold sm:text-4xl">
            {paid ? (
              <CheckCircle2Icon aria-hidden className="size-8 text-success" />
            ) : cancelled ? (
              <XCircleIcon aria-hidden className="size-8 text-destructive" />
            ) : (
              <ClockIcon aria-hidden className="size-8 text-warning" />
            )}
            {headline}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Placed {formatManila(order.placed_at)} · Updates go to {order.email_masked}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge
              tone={ORDER_STATUS_META[order.status as OrderStatus]?.tone ?? "neutral"}
            >
              {ORDER_STATUS_META[order.status as OrderStatus]?.label ?? order.status}
            </StatusBadge>
            <StatusBadge
              tone={
                PAYMENT_STATUS_META[order.payment_status as PaymentStatus]?.tone ??
                "neutral"
              }
              dot={false}
            >
              Payment:{" "}
              {PAYMENT_STATUS_META[order.payment_status as PaymentStatus]?.label ??
                order.payment_status}
            </StatusBadge>
            {cancelled && order.cancellation_reason === "payment_timeout" ? (
              <StatusBadge tone="neutral" dot={false}>
                Payment window expired
              </StatusBadge>
            ) : null}
          </div>
        </header>

        <PaymentPanel order={order} token={token!} />

        <section
          aria-labelledby="delivery-heading"
          className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
        >
          <h2 id="delivery-heading" className="font-serif text-xl font-semibold">
            Delivery
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">When</dt>
              <dd className="font-medium">
                {order.delivery_date
                  ? formatManila(`${order.delivery_date}T00:00:00+08:00`, {
                      dateStyle: "full",
                    })
                  : "—"}
                {order.delivery_slot ? (
                  <span className="block text-muted-foreground">
                    {order.delivery_slot.label}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">To</dt>
              <dd className="font-medium">
                {order.recipient?.full_name}
                <span className="block text-muted-foreground">
                  {order.recipient?.address_line1}, {order.recipient?.barangay},{" "}
                  {order.recipient?.city} · {order.recipient?.phone_masked}
                </span>
              </dd>
            </div>
            {order.gift_message ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Card message</dt>
                <dd className="font-serif italic">“{order.gift_message}”</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="font-serif text-xl font-semibold">
            Progress
          </h2>
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {order.history.map((h, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/5"
              >
                <span>
                  <span className="text-muted-foreground capitalize">{h.kind}</span> →{" "}
                  <span className="font-medium">{h.to_status.replaceAll("_", " ")}</span>
                </span>
                <time className="text-xs text-muted-foreground">
                  {formatManila(h.at)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside
        className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-24"
        aria-label="Order items"
      >
        <h2 className="font-serif text-xl font-semibold">Items</h2>
        <ul className="mt-3 divide-y text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex gap-3 py-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                <Image
                  src={productImageSrc(item.image_path)}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{item.product_name}</span>
                <span className="block text-muted-foreground">
                  {item.variant_name} × {item.quantity}
                </span>
                {item.add_ons.map((a, j) => (
                  <span key={j} className="block text-xs text-muted-foreground">
                    + {a.name}
                  </span>
                ))}
              </span>
              <span className="tabular-nums">
                {formatCentavos(
                  item.line_total_centavos +
                    item.add_ons.reduce((s, a) => s + a.line_total_centavos, 0),
                )}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Items</dt>
            <dd className="tabular-nums">
              {formatCentavos(order.subtotal_centavos + order.add_ons_centavos)}
            </dd>
          </div>
          {order.discount_centavos > 0 ? (
            <div className="flex justify-between text-success">
              <dt>Promo {order.promo_code}</dt>
              <dd className="tabular-nums">−{formatCentavos(order.discount_centavos)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="tabular-nums">
              {order.delivery_fee_centavos
                ? formatCentavos(order.delivery_fee_centavos)
                : "Free"}
            </dd>
          </div>
          <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="order-total">
              {formatCentavos(order.total_centavos)}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export default function OrderTrackingPage(props: PageProps<"/orders/[number]">) {
  return (
    <Container className="py-10 sm:py-14">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Tracking params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
