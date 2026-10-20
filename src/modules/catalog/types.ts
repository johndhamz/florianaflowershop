import type { Centavos } from "@/lib/money";

export const PRODUCT_CATEGORIES = [
  "everyday",
  "bouquets",
  "orchids",
  "arrangements",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  everyday: "Everyday Blooms",
  bouquets: "Premium Bouquets",
  orchids: "Orchid Gifts",
  arrangements: "Arrangements",
};

export type ProductBadge = "new" | "bestseller" | "limited";

/** Read model used by storefront cards. Persisted shape arrives with the catalog phase. */
export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  priceCentavos: Centavos;
  compareAtPriceCentavos?: Centavos;
  image: { src: string; alt: string };
  badge?: ProductBadge;
  availability: "in_stock" | "low_stock" | "out_of_stock";
};
