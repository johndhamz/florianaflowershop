import type { StatusTone } from "@/components/shared/status-badge";

import type { OrderStatus, PaymentStatus } from "./types";

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: StatusTone }> =
  {
    pending: { label: "Pending", tone: "neutral" },
    confirmed: { label: "Confirmed", tone: "info" },
    preparing: { label: "Preparing", tone: "warning" },
    out_for_delivery: { label: "Out for delivery", tone: "info" },
    delivered: { label: "Delivered", tone: "success" },
    cancelled: { label: "Cancelled", tone: "danger" },
  };

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: StatusTone }
> = {
  unpaid: { label: "Unpaid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
};
