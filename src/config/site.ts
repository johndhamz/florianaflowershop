/**
 * Static site configuration. Safe to import from both server and client code.
 * Secrets never live here — see `@/lib/env`.
 */
export const siteConfig = {
  name: "Floriana Flowers",
  tagline: "Love, in every bloom.",
  description:
    "Fresh everyday flowers, premium bouquets, orchid gifts and elegant arrangements, delivered across Cebu.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "en-PH",
  currency: "PHP",
  timeZone: "Asia/Manila",
  location: "Cebu, Philippines",
  contact: {
    email: "hello@florianaflowers.ph",
    phone: "+63 900 000 0000",
    instagram: "https://instagram.com/florianaflowers",
    facebook: "https://facebook.com/florianaflowers",
  },
} as const;

export type NavItem = {
  label: string;
  href: string;
  description?: string;
};

/** Storefront primary navigation. Routes beyond "/" ship in later phases. */
export const storefrontNav: readonly NavItem[] = [
  { label: "Shop", href: "/shop" },
  { label: "Bouquets", href: "/collections/premium-bouquets" },
  { label: "Orchids", href: "/collections/lolas-orchid-collection" },
  { label: "Everyday Blooms", href: "/collections/everyday-blooms" },
  { label: "Occasions", href: "/occasions" },
  { label: "Delivery", href: "/delivery" },
] as const;

export const footerNav = {
  shop: [
    { label: "All flowers", href: "/shop" },
    { label: "Premium bouquets", href: "/collections/premium-bouquets" },
    { label: "Orchid gifts", href: "/collections/lolas-orchid-collection" },
    { label: "Everyday blooms", href: "/collections/everyday-blooms" },
    { label: "Arrangements", href: "/collections/arrangements" },
  ],
  help: [
    { label: "Delivery zones & slots", href: "/delivery" },
    { label: "FAQs", href: "/faqs" },
    { label: "Contact us", href: "/contact" },
  ],
  company: [
    { label: "Our story", href: "/our-story" },
    { label: "Privacy notice", href: "/privacy" },
  ],
} as const satisfies Record<string, readonly NavItem[]>;
