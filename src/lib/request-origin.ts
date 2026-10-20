import "server-only";

import { headers } from "next/headers";

import { siteConfig } from "@/config/site";

/**
 * Origin of the current request (scheme + host), for building absolute URLs
 * such as payment redirect targets. Falls back to the configured site URL.
 * Request-time only (reads headers()).
 */
export async function getRequestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return siteConfig.url;
    const proto =
      h.get("x-forwarded-proto") ??
      (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return siteConfig.url;
  }
}
