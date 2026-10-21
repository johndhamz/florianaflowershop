import { formatCentavos } from "@/lib/money";

export type TemplateInput = {
  template: string;
  payload: Record<string, unknown>;
  siteUrl: string;
  shopName: string;
};
export type Rendered = { subject: string; html: string; text: string };

function esc(s: unknown) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function layout(
  shopName: string,
  title: string,
  body: string,
  cta?: { label: string; href: string },
) {
  return `<!doctype html><html><body style="margin:0;background:#F7F0E7;font-family:Inter,Arial,sans-serif;color:#3F2B23">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-family:Georgia,serif;font-size:22px;margin:0 0 20px">${esc(shopName)}</p>
    <div style="background:#FDFBF8;border-radius:16px;padding:24px;border:1px solid #E6D9C9">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${title}</h1>
      ${body}
      ${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="background:#614438;color:#F7F0E7;text-decoration:none;padding:12px 18px;border-radius:10px;display:inline-block">${esc(cta.label)}</a></p>` : ""}
    </div>
    <p style="font-size:12px;color:#7A6256;margin-top:16px">Love, in every bloom. · Cebu, Philippines</p>
  </div></body></html>`;
}

export function renderTemplate({
  template,
  payload,
  siteUrl,
  shopName,
}: TemplateInput): Rendered {
  const p = payload as {
    order_number?: string;
    customer_name?: string;
    total_centavos?: number;
    delivery_date?: string;
    delivery_slot?: string;
    tracking_path?: string;
    attempt?: number;
    items?: { name: string; available: number; threshold: number; unit: string }[];
    count?: number;
    payment_method?: string;
  };
  const track = p.tracking_path
    ? { label: "Track your order", href: `${siteUrl}${p.tracking_path}` }
    : undefined;
  const when = p.delivery_date
    ? `${p.delivery_date}${p.delivery_slot ? ` · ${p.delivery_slot}` : ""}`
    : "";
  const hi = `<p>Hi ${esc(p.customer_name ?? "there")},</p>`;

  switch (template) {
    case "order.placed": {
      const bank = p.payment_method === "bank_transfer";
      const body = `${hi}<p>We received order <strong>${esc(p.order_number)}</strong> for ${when ? esc(when) : "delivery"}. Total ${formatCentavos(p.total_centavos ?? 0)}.</p>${bank ? "<p>Please complete your bank transfer and upload the receipt on your order page. We hold your flowers for 24 hours.</p>" : "<p>Once your payment is confirmed we'll start preparing your flowers.</p>"}`;
      return {
        subject: `We received your order ${p.order_number}`,
        html: layout(shopName, "Order received", body, track),
        text: `We received order ${p.order_number}. ${bank ? "Please complete your bank transfer and upload the receipt." : "We'll confirm once payment is received."} ${track?.href ?? ""}`,
      };
    }
    case "payment.confirmed":
      return {
        subject: `Payment confirmed for ${p.order_number}`,
        html: layout(
          shopName,
          "Payment confirmed",
          `${hi}<p>Thank you! Payment for <strong>${esc(p.order_number)}</strong> is confirmed. Delivery ${esc(when)}.</p>`,
          track,
        ),
        text: `Payment confirmed for ${p.order_number}. Delivery ${when}. ${track?.href ?? ""}`,
      };
    case "preparation.complete":
      return {
        subject: `Your flowers are ready: ${p.order_number}`,
        html: layout(
          shopName,
          "Your flowers are ready",
          `${hi}<p>Order <strong>${esc(p.order_number)}</strong> has been arranged by our florist and is ready for dispatch (${esc(when)}).</p>`,
          track,
        ),
        text: `Order ${p.order_number} is ready for dispatch. ${track?.href ?? ""}`,
      };
    case "delivery.out":
      return {
        subject: `Your flowers are on the way: ${p.order_number}`,
        html: layout(
          shopName,
          "On the way",
          `${hi}<p>Our rider has left with order <strong>${esc(p.order_number)}</strong>. We'll message the recipient before arriving.</p>`,
          track,
        ),
        text: `Order ${p.order_number} is out for delivery. ${track?.href ?? ""}`,
      };
    case "delivery.delivered":
      return {
        subject: `Delivered: ${p.order_number}`,
        html: layout(
          shopName,
          "Delivered",
          `${hi}<p>Order <strong>${esc(p.order_number)}</strong> has been delivered. We hope it brought a smile.</p>`,
          track,
        ),
        text: `Order ${p.order_number} has been delivered. ${track?.href ?? ""}`,
      };
    case "delivery.failed":
      return {
        subject: `We could not complete your delivery: ${p.order_number}`,
        html: layout(
          shopName,
          "Delivery attempt unsuccessful",
          `${hi}<p>We tried to deliver order <strong>${esc(p.order_number)}</strong>${p.attempt ? ` (attempt ${p.attempt})` : ""} but could not complete it. Our team will contact you to arrange a retry or a new schedule.</p>`,
          track,
        ),
        text: `We could not complete delivery of ${p.order_number}. Our team will contact you. ${track?.href ?? ""}`,
      };
    case "inventory.low_stock": {
      const rows = (p.items ?? [])
        .map(
          (i) =>
            `<tr><td style="padding:4px 8px">${esc(i.name)}</td><td style="padding:4px 8px;text-align:right">${esc(i.available)} ${esc(i.unit)}</td><td style="padding:4px 8px;text-align:right">${esc(i.threshold)}</td></tr>`,
        )
        .join("");
      return {
        subject: `${p.count} material${p.count === 1 ? " is" : "s are"} low on stock`,
        html: layout(
          shopName,
          "Low-stock alert",
          `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th align="left" style="padding:4px 8px">Material</th><th align="right" style="padding:4px 8px">Available</th><th align="right" style="padding:4px 8px">Threshold</th></tr></thead><tbody>${rows}</tbody></table>`,
          { label: "Open inventory", href: `${siteUrl}/admin/inventory` },
        ),
        text: `${p.count} materials are low on stock.`,
      };
    }
    default:
      return {
        subject: template,
        html: layout(
          shopName,
          template,
          `<pre>${esc(JSON.stringify(payload, null, 2))}</pre>`,
        ),
        text: JSON.stringify(payload),
      };
  }
}

/** Short SMS copy (≤ 160 chars) for the delivery events; only used when SMS is enabled. */
export function renderSms(
  template: string,
  payload: Record<string, unknown>,
  siteUrl: string,
): string {
  const p = payload as { order_number?: string; tracking_path?: string };
  const url = p.tracking_path ? `${siteUrl}${p.tracking_path}` : "";
  switch (template) {
    case "delivery.out":
      return `Floriana: your flowers (${p.order_number}) are on the way. ${url}`.slice(
        0,
        160,
      );
    case "delivery.delivered":
      return `Floriana: order ${p.order_number} delivered. Thank you!`.slice(0, 160);
    case "delivery.failed":
      return `Floriana: we couldn't complete delivery of ${p.order_number}. We'll contact you to reschedule.`.slice(
        0,
        160,
      );
    default:
      return `Floriana: update on order ${p.order_number}. ${url}`.slice(0, 160);
  }
}
