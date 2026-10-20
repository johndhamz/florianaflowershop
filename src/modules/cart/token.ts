import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

export const CART_COOKIE = "ff_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches carts.expires_at
const TOKEN_RE = /^[a-f0-9]{64}$/;

/** Reads the shopper's cart token (request-time). Returns null when absent/malformed. */
export async function readCartToken(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && TOKEN_RE.test(value) ? value : null;
}

/**
 * Returns the existing token or mints a new one and sets the httpOnly cookie.
 * Only callable from Server Actions / Route Handlers (cookies are writable there).
 */
export async function ensureCartToken(): Promise<string> {
  const existing = await readCartToken();
  if (existing) return existing;
  const token = randomBytes(32).toString("hex");
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return token;
}
