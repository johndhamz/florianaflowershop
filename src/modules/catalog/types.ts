import type { Database } from "@/lib/supabase/database.types";
import type { Centavos } from "@/lib/money";

export type CatalogRow = Database["public"]["Views"]["catalog_products"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
export type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
export type CollectionRow = Database["public"]["Tables"]["collections"]["Row"];
export type OccasionRow = Database["public"]["Tables"]["occasions"]["Row"];
export type AddOnRow = Database["public"]["Tables"]["add_ons"]["Row"];

export type Availability = "in_stock" | "low_stock" | "out_of_stock" | "untracked";

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  in_stock: "In stock",
  low_stock: "Few left",
  out_of_stock: "Sold out",
  untracked: "Made to order",
};

export type ProductBadge = "new" | "bestseller" | "limited";

/** Read model used by product cards and listings. */
export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  collectionSlug: string | null;
  collectionName: string | null;
  priceCentavos: Centavos;
  compareAtPriceCentavos: Centavos | null;
  minPriceCentavos: Centavos;
  maxPriceCentavos: Centavos;
  variantCount: number;
  image: { src: string; alt: string };
  availability: Availability;
  badge?: ProductBadge;
};

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  priceCentavos: Centavos;
  compareAtPriceCentavos: Centavos | null;
  isDefault: boolean;
  availability: Availability;
  availableQuantity: number | null;
};

export type ProductAddOn = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceCentavos: Centavos;
  maxQuantity: number;
  image: string | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  careInstructions: string | null;
  collection: { slug: string; name: string } | null;
  occasions: { slug: string; name: string }[];
  tags: { slug: string; name: string }[];
  images: { src: string; alt: string; width: number | null; height: number | null }[];
  variants: ProductVariant[];
  addOns: ProductAddOn[];
  isBestSeller: boolean;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
};

export type CollectionSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  image: string;
  productCount: number;
};

export type OccasionSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};
