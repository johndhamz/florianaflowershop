import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PayMongo webhook signature (docs: "Securing a webhook"):
 *   Paymongo-Signature: t=<timestamp>,te=<test-mode sig>,li=<live-mode sig>
 *   signed string  = `${t}.${rawBody}`
 *   signature      = HMAC-SHA256(webhook secret_key, signed string), hex
 * Compare against `li` for live events and `te` for test events.
 */
export function parseSignatureHeader(
  header: string | null,
): { t: string; te?: string; li?: string } | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const segment of header.split(",")) {
    const [k, v] = segment.trim().split("=");
    if (k && v !== undefined) parts[k] = v;
  }
  if (!parts.t) return null;
  return { t: parts.t, te: parts.te, li: parts.li };
}

export function computeSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function signaturesMatch(a: string | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function verifyPaymongoSignature(opts: {
  header: string | null;
  rawBody: string;
  secret: string;
  livemode: boolean;
  /** Seconds; reject stale/replayed deliveries beyond this window. */
  toleranceSeconds?: number;
  now?: number;
}): boolean {
  const parsed = parseSignatureHeader(opts.header);
  if (!parsed) return false;
  const expected = computeSignature(opts.secret, parsed.t, opts.rawBody);
  const provided = opts.livemode ? parsed.li : parsed.te;
  if (!signaturesMatch(provided, expected)) return false;
  const tolerance = opts.toleranceSeconds ?? 300;
  const ts = Number(parsed.t);
  if (!Number.isFinite(ts)) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= tolerance;
}

/** Builds a header exactly as PayMongo would (used by the mock provider and tests). */
export function buildSignatureHeader(
  secret: string,
  rawBody: string,
  livemode: boolean,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const sig = computeSignature(secret, String(timestamp), rawBody);
  return livemode ? `t=${timestamp},te=,li=${sig}` : `t=${timestamp},te=${sig},li=`;
}
