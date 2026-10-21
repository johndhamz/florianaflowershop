import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrderActions } from "@/components/admin/orders/order-actions";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManila } from "@/lib/datetime";
import { formatCentavos } from "@/lib/money";
import { requireStaff } from "@/modules/auth/dal";
import { roleCan } from "@/modules/auth/permissions";
import { getAdminOrder } from "@/modules/orders/admin-queries";

export const metadata: Metadata = { title: "Order" };

async function Order({
  params,
}: {
  params: PageProps<"/admin/orders/[orderId]">["params"];
}) {
  const staff = await requireStaff("orders.read");
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(orderId)) notFound();
  const order = await getAdminOrder(orderId);
  if (!order) notFound();
  const canCancel =
    roleCan(staff.role, "orders.cancel") &&
    order.status !== "cancelled" &&
    order.delivery_status !== "delivered";
  const canNotes = roleCan(staff.role, "orders.notes.update");
  const canSeeMoney = roleCan(staff.role, "payments.read");
  const slot = order.delivery_slot_snapshot as { label?: string } | null;
  const zone = order.delivery_zone_snapshot as { name?: string } | null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title={order.order_number}
        description={`Placed ${formatManila(order.placed_at)} · ${order.customer_name}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">All orders</Link>
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2" aria-label="Order state">
        <StatusBadge
          tone={
            order.status === "cancelled"
              ? "neutral"
              : order.status === "completed"
                ? "success"
                : "info"
          }
          dot={false}
          data-testid="order-status"
        >
          Order: {order.status}
        </StatusBadge>
        <StatusBadge
          tone={
            order.payment_status === "paid"
              ? "success"
              : order.payment_status.includes("refund")
                ? "info"
                : "warning"
          }
          dot={false}
          data-testid="payment-status"
        >
          Payment: {order.payment_status.replaceAll("_", " ")}
        </StatusBadge>
        <StatusBadge tone="neutral" dot={false}>
          Prep: {order.fulfillment_status}
        </StatusBadge>
        <StatusBadge tone="neutral" dot={false}>
          Delivery: {order.delivery_status.replaceAll("_", " ")}
        </StatusBadge>
      </div>
      {order.status === "cancelled" ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm" role="status">
          Cancelled {order.cancelled_at ? formatManila(order.cancelled_at) : ""}:{" "}
          {order.cancellation_reason}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="font-sans text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <caption className="sr-only">Order items</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 font-medium">Item</th>
                    <th className="py-1 text-right font-medium">Qty</th>
                    {canSeeMoney ? (
                      <th className="py-1 text-right font-medium">Line</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {order.order_items.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="py-2">
                        {i.product_name}{" "}
                        <span className="text-muted-foreground">· {i.variant_name}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{i.sku}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                      {canSeeMoney ? (
                        <td className="py-2 text-right tabular-nums">
                          {formatCentavos(i.line_total_centavos)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
                {canSeeMoney ? (
                  <tfoot className="text-xs">
                    <tr className="border-t">
                      <td className="pt-2" colSpan={2}>
                        Subtotal
                      </td>
                      <td className="pt-2 text-right tabular-nums">
                        {formatCentavos(order.subtotal_centavos + order.add_ons_centavos)}
                      </td>
                    </tr>
                    {order.discount_centavos ? (
                      <tr>
                        <td colSpan={2}>
                          Discount{" "}
                          {order.promo_code_snapshot
                            ? `(${order.promo_code_snapshot})`
                            : ""}
                        </td>
                        <td className="text-right tabular-nums">
                          −{formatCentavos(order.discount_centavos)}
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td colSpan={2}>Delivery fee</td>
                      <td className="text-right tabular-nums">
                        {formatCentavos(order.delivery_fee_centavos)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td colSpan={2}>Total</td>
                      <td className="text-right tabular-nums">
                        {formatCentavos(order.total_centavos)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="font-sans text-base">Delivery</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Date · slot</span>
                <br />
                {order.delivery_date} · {slot?.label ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Zone</span>
                <br />
                {zone?.name ?? "—"}
              </p>
              {order.recipient ? (
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Recipient</span>
                  <br />
                  {order.recipient.full_name}
                  {order.recipient.phone ? ` · ${order.recipient.phone}` : ""}
                  <br />
                  {[
                    order.recipient.address_line1,
                    order.recipient.address_line2,
                    order.recipient.barangay,
                    order.recipient.city,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  {order.recipient.landmark ? ` (${order.recipient.landmark})` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground sm:col-span-2">
                  Recipient details are restricted for your role.
                </p>
              )}
              {order.delivery_instructions ? (
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Instructions</span>
                  <br />
                  {order.delivery_instructions}
                </p>
              ) : null}
              {order.gift_message ? (
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Gift message</span>
                  <br />
                  {order.gift_message}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {canSeeMoney ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="font-sans text-base">
                  Payments &amp; refunds
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {order.payments.length === 0 ? (
                  <p className="text-muted-foreground">No payment attempts.</p>
                ) : null}
                {order.payments.map((p) => (
                  <div key={p.id} className="rounded-lg border px-3 py-2">
                    <p className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {p.provider} · {p.method} · attempt {p.attempt}
                      </span>
                      <span className="tabular-nums">
                        {formatCentavos(p.amount_centavos)}{" "}
                        <StatusBadge
                          tone={
                            p.status === "paid"
                              ? "success"
                              : p.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                          dot={false}
                        >
                          {p.status}
                        </StatusBadge>
                      </span>
                    </p>
                    {p.refunds.length ? (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {p.refunds.map((r) => (
                          <li key={r.id}>
                            Refund {formatCentavos(r.amount_centavos)} · {r.status} ·{" "}
                            {r.reason}
                            {r.processed_at ? ` · ${formatManila(r.processed_at)}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="self-start" asChild>
                  <Link href="/admin/payments">Open payments to verify or refund</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <OrderActions
            orderId={order.id}
            orderNumber={order.order_number}
            canCancel={canCancel}
            canNotes={canNotes}
            notes={order.internal_notes ?? ""}
          />
          <Card size="sm">
            <CardHeader>
              <CardTitle className="font-sans text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{order.customer_name}</p>
              {roleCan(staff.role, "customers.update") ? (
                <p className="text-muted-foreground">
                  {order.customer_email}
                  <br />
                  {order.customer_phone}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Contact details restricted for your role.
                </p>
              )}
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle className="font-sans text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1 text-xs">
                {order.order_status_history
                  .slice()
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((h, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">
                        {formatManila(h.created_at)}
                      </span>{" "}
                      · {h.from_status ?? "—"} → {h.to_status}
                      {h.note ? ` · ${h.note}` : ""}
                    </li>
                  ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrderPage(props: PageProps<"/admin/orders/[orderId]">) {
  return (
    <Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
      <Order params={props.params} />
    </Suspense>
  );
}
