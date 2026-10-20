import type { Centavos } from "@/lib/money";
import type { Availability } from "@/modules/catalog/types";

export type CartAddOnLine = {
  add_on_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price_centavos: Centavos;
  line_total_centavos: Centavos;
  is_available: boolean;
};

export type CartLine = {
  id: string;
  variant_id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  variant_name: string;
  sku: string;
  image_path: string | null;
  image_alt: string | null;
  quantity: number;
  unit_price_centavos: Centavos;
  unit_price_at_add_centavos: Centavos;
  price_changed: boolean;
  line_total_centavos: Centavos;
  availability: Availability;
  available_quantity: number | null;
  is_available: boolean;
  add_ons: CartAddOnLine[];
  add_ons_total_centavos: Centavos;
  created_at: string;
};

/** Shape returned by the `cart_get` family of RPCs. Totals are server-computed. */
export type Cart = {
  id: string | null;
  items: CartLine[];
  item_count: number;
  subtotal_centavos: Centavos;
  add_ons_centavos: Centavos;
  total_centavos: Centavos;
  has_issues: boolean;
};

export const EMPTY_CART: Cart = {
  id: null,
  items: [],
  item_count: 0,
  subtotal_centavos: 0,
  add_ons_centavos: 0,
  total_centavos: 0,
  has_issues: false,
};

export type AddOnSelection = { add_on_id: string; quantity: number };
