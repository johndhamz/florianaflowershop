import { siteConfig } from "@/config/site";

/** All customer-facing dates render in Asia/Manila regardless of server locale. */
export function formatManila(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    timeZone: siteConfig.timeZone,
    ...options,
  }).format(new Date(date));
}
