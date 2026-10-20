import { productImageSrc } from "@/lib/supabase/storage";

import type { Availability, CatalogRow, ProductSummary } from "./types";

const NEW_WINDOW_DAYS = 30;

export function toProductSummary(row: CatalogRow): ProductSummary {
  const isNew =
    !!row.published_at &&
    Date.now() - new Date(row.published_at).getTime() < NEW_WINDOW_DAYS * 86_400_000;

  return {
    id: row.id!,
    slug: row.slug!,
    name: row.name!,
    shortDescription: row.short_description,
    collectionSlug: row.collection_slug,
    collectionName: row.collection_name,
    priceCentavos: row.price_centavos ?? row.min_price_centavos ?? 0,
    compareAtPriceCentavos: row.compare_at_price_centavos,
    minPriceCentavos: row.min_price_centavos ?? row.price_centavos ?? 0,
    maxPriceCentavos: row.max_price_centavos ?? row.price_centavos ?? 0,
    variantCount: Number(row.variant_count ?? 1),
    image: {
      src: productImageSrc(row.image_path, row.collection_slug),
      alt: row.image_alt ?? row.name ?? "Product photo",
    },
    availability: (row.availability as Availability | null) ?? "untracked",
    badge: row.is_best_seller ? "bestseller" : isNew ? "new" : undefined,
  };
}
