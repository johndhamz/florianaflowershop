"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createPublicClient } from "@/lib/supabase/public";

import { ensureCartToken, readCartToken } from "./token";
import { type Cart, EMPTY_CART } from "./types";

export type CartActionResult =
  | { ok: true; cart: Cart; message?: string }
  | { ok: false; error: string; code?: string };

const uuid = z.uuid();

const addToCartSchema = z.object({
  variantId: uuid,
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  addOns: z
    .array(z.object({ add_on_id: uuid, quantity: z.number().int().min(1).max(20) }))
    .max(10)
    .default([]),
});

const updateSchema = z.object({
  itemId: uuid,
  quantity: z.coerce.number().int().min(0).max(50),
});

/** Maps database errors (app.raise → P0001 with a readable message) to user-facing text. */
function toUserError(error: {
  message: string;
  details?: string | null;
  code?: string;
}): CartActionResult {
  const code = error.details ?? undefined;
  const message = error.message.startsWith("Only ")
    ? error.message
    : code === "PRODUCT_UNAVAILABLE"
      ? "This product is no longer available."
      : code === "INVALID_ADD_ON"
        ? "One of the add-ons is not available for this product."
        : code === "INVALID_QUANTITY"
          ? error.message
          : "We could not update your cart. Please try again.";
  return { ok: false, error: message, code };
}

export async function addToCart(
  input: z.input<typeof addToCartSchema>,
): Promise<CartActionResult> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Invalid selection.", code: "INVALID_INPUT" };

  const token = await ensureCartToken();
  const { data, error } = await createPublicClient().rpc("cart_add_item", {
    p_token: token,
    p_variant_id: parsed.data.variantId,
    p_quantity: parsed.data.quantity,
    p_add_ons: parsed.data.addOns,
  });
  if (error) return toUserError(error);
  revalidatePath("/cart");
  return { ok: true, cart: (data as Cart) ?? EMPTY_CART, message: "Added to your cart." };
}

export async function updateCartItem(
  input: z.input<typeof updateSchema>,
): Promise<CartActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Invalid quantity.", code: "INVALID_INPUT" };
  const token = await readCartToken();
  if (!token) return { ok: true, cart: EMPTY_CART };

  const { data, error } = await createPublicClient().rpc("cart_update_item", {
    p_token: token,
    p_item_id: parsed.data.itemId,
    p_quantity: parsed.data.quantity,
  });
  if (error) return toUserError(error);
  revalidatePath("/cart");
  return { ok: true, cart: (data as Cart) ?? EMPTY_CART };
}

export async function removeCartItem(itemId: string): Promise<CartActionResult> {
  if (!uuid.safeParse(itemId).success)
    return { ok: false, error: "Invalid item.", code: "INVALID_INPUT" };
  const token = await readCartToken();
  if (!token) return { ok: true, cart: EMPTY_CART };

  const { data, error } = await createPublicClient().rpc("cart_remove_item", {
    p_token: token,
    p_item_id: itemId,
  });
  if (error) return toUserError(error);
  revalidatePath("/cart");
  return {
    ok: true,
    cart: (data as Cart) ?? EMPTY_CART,
    message: "Removed from your cart.",
  };
}

export async function removeUnavailableItems(): Promise<CartActionResult> {
  const token = await readCartToken();
  if (!token) return { ok: true, cart: EMPTY_CART };
  const { data, error } = await createPublicClient().rpc("cart_remove_unavailable", {
    p_token: token,
  });
  if (error) return toUserError(error);
  revalidatePath("/cart");
  return {
    ok: true,
    cart: (data as Cart) ?? EMPTY_CART,
    message: "Your cart has been updated.",
  };
}
