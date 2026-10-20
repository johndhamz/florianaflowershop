import type { ProductSummary } from "./types";

/**
 * Phase 1 placeholder catalog so the homepage shell has realistic content.
 * Replaced by Supabase-backed queries in the catalog phase. Images are local
 * illustrative placeholders, not final product photography.
 */
export const sampleProducts: readonly ProductSummary[] = [
  {
    id: "p_lola_orchid",
    slug: "lolas-phalaenopsis",
    name: "Lola's Phalaenopsis",
    category: "orchids",
    priceCentavos: 189_000,
    image: {
      src: "/images/placeholders/orchid.svg",
      alt: "White phalaenopsis orchid in a ceramic pot",
    },
    badge: "bestseller",
    availability: "in_stock",
  },
  {
    id: "p_sunday_market",
    slug: "sunday-market-bunch",
    name: "Sunday Market Bunch",
    category: "everyday",
    priceCentavos: 45_000,
    image: {
      src: "/images/placeholders/everyday.svg",
      alt: "Loose bunch of mixed seasonal flowers",
    },
    availability: "in_stock",
  },
  {
    id: "p_blush_romance",
    slug: "blush-romance",
    name: "Blush Romance",
    category: "bouquets",
    priceCentavos: 249_000,
    compareAtPriceCentavos: 279_000,
    image: {
      src: "/images/placeholders/bouquet.svg",
      alt: "Pink and cream rose bouquet wrapped in paper",
    },
    badge: "new",
    availability: "low_stock",
  },
  {
    id: "p_sage_garden",
    slug: "sage-garden-arrangement",
    name: "Sage Garden Arrangement",
    category: "arrangements",
    priceCentavos: 320_000,
    image: {
      src: "/images/placeholders/arrangement.svg",
      alt: "Low table arrangement with greenery",
    },
    availability: "in_stock",
  },
  {
    id: "p_cebu_morning",
    slug: "cebu-morning",
    name: "Cebu Morning",
    category: "everyday",
    priceCentavos: 65_000,
    image: {
      src: "/images/placeholders/everyday.svg",
      alt: "Bright yellow and white everyday flowers",
    },
    availability: "in_stock",
  },
  {
    id: "p_ivory_elegance",
    slug: "ivory-elegance",
    name: "Ivory Elegance",
    category: "bouquets",
    priceCentavos: 395_000,
    image: {
      src: "/images/placeholders/bouquet.svg",
      alt: "Ivory and white premium bouquet",
    },
    badge: "limited",
    availability: "out_of_stock",
  },
];
