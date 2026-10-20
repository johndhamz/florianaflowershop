import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

import { readCartToken } from "./token";
import { type Cart, EMPTY_CART } from "./types";

/** Current shopper's cart with live prices. Request-time (reads the cookie). */
export async function getCart(): Promise<Cart> {
  const token = await readCartToken();
  if (!token) return EMPTY_CART;
  const { data, error } = await createPublicClient().rpc("cart_get", { p_token: token });
  if (error) throw new Error(`cart_get: ${error.message}`);
  return (data as Cart | null) ?? EMPTY_CART;
}

export async function getCartCount(): Promise<number> {
  const cart = await getCart();
  return cart.item_count;
}
