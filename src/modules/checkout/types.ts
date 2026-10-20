export type DeliveryOption = {
  slot_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  remaining: number;
  available: boolean;
};

export type DeliveryOptions = {
  ok: boolean;
  date_ok?: boolean;
  message?: string | null;
  fee_centavos?: number;
  free_delivery_threshold_centavos?: number | null;
  min_order_centavos?: number;
  slots?: DeliveryOption[];
};

export type PromoCheck =
  | {
      valid: true;
      promo_id: string;
      code: string;
      description: string | null;
      discount_centavos: number;
    }
  | { valid: false; message: string };

export type PlaceOrderResult =
  | {
      ok: true;
      orderNumber: string;
      trackingToken: string;
      next: { kind: "redirect"; url: string } | { kind: "instructions" };
    }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };
