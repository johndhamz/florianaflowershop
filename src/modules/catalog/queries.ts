import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { productImageSrc, storagePublicUrl } from "@/lib/supabase/storage";

import { toProductSummary } from "./mappers";
import { type CatalogSearchParams, PAGE_SIZE } from "./search-params";
import type {
  Availability,
  CollectionSummary,
  OccasionSummary,
  ProductDetail,
  ProductSummary,
} from "./types";

export const CATALOG_TAG = "catalog";

export type ProductPage = {
  items: ProductSummary[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * Product listing with search, filters, sorting and pagination.
 * Cached briefly; availability is embedded so stock changes surface within minutes.
 */
export async function listProducts(params: CatalogSearchParams): Promise<ProductPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const supabase = createPublicClient();
  let query = supabase
    .from("catalog_products")
    .select("*", { count: "exact" })
    .eq("status", "active");

  if (params.q)
    query = query.textSearch("search_vector", params.q, {
      type: "websearch",
      config: "english",
    });
  if (params.collection) query = query.eq("collection_slug", params.collection);
  if (params.occasion) query = query.contains("occasion_slugs", [params.occasion]);
  if (params.min !== undefined) query = query.gte("price_centavos", params.min * 100);
  if (params.max !== undefined) query = query.lte("price_centavos", params.max * 100);

  switch (params.sort) {
    case "price-asc":
      query = query.order("price_centavos", { ascending: true }).order("name");
      break;
    case "price-desc":
      query = query.order("price_centavos", { ascending: false }).order("name");
      break;
    case "newest":
      query = query
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("name");
      break;
    case "name":
      query = query.order("name");
      break;
    default:
      query = query
        .order("is_featured", { ascending: false })
        .order("is_best_seller", { ascending: false })
        .order("position")
        .order("name");
  }

  const from = (params.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`listProducts: ${error.message}`);

  const total = count ?? 0;
  return {
    items: (data ?? []).map(toProductSummary),
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function listBestSellers(limit = 4): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const { data, error } = await createPublicClient()
    .from("catalog_products")
    .select("*")
    .eq("status", "active")
    .eq("is_best_seller", true)
    .order("position")
    .limit(limit);
  if (error) throw new Error(`listBestSellers: ${error.message}`);
  return (data ?? []).map(toProductSummary);
}

export async function listFeaturedProducts(limit = 6): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const { data, error } = await createPublicClient()
    .from("catalog_products")
    .select("*")
    .eq("status", "active")
    .eq("is_featured", true)
    .order("position")
    .limit(limit);
  if (error) throw new Error(`listFeaturedProducts: ${error.message}`);
  return (data ?? []).map(toProductSummary);
}

export async function listCollectionProducts(
  collectionSlug: string,
  limit = 4,
): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const { data, error } = await createPublicClient()
    .from("catalog_products")
    .select("*")
    .eq("status", "active")
    .eq("collection_slug", collectionSlug)
    .order("is_best_seller", { ascending: false })
    .order("position")
    .limit(limit);
  if (error) throw new Error(`listCollectionProducts: ${error.message}`);
  return (data ?? []).map(toProductSummary);
}

export async function listCollections(): Promise<CollectionSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const supabase = createPublicClient();
  const [{ data: collections, error }, { data: products }] = await Promise.all([
    supabase.from("collections").select("*").eq("is_active", true).order("position"),
    supabase.from("catalog_products").select("collection_id").eq("status", "active"),
  ]);
  if (error) throw new Error(`listCollections: ${error.message}`);
  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.collection_id)
      counts.set(p.collection_id, (counts.get(p.collection_id) ?? 0) + 1);
  }
  return (collections ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    seoTitle: c.seo_title,
    seoDescription: c.seo_description,
    image: productImageSrc(c.image_path, c.slug),
    productCount: counts.get(c.id) ?? 0,
  }));
}

export async function getCollection(slug: string): Promise<CollectionSummary | null> {
  const all = await listCollections();
  return all.find((c) => c.slug === slug) ?? null;
}

export async function listOccasions(): Promise<OccasionSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const { data, error } = await createPublicClient()
    .from("occasions")
    .select("id, slug, name, description")
    .eq("is_active", true)
    .order("position");
  if (error) throw new Error(`listOccasions: ${error.message}`);
  return data ?? [];
}

export async function getOccasion(slug: string): Promise<OccasionSummary | null> {
  const all = await listOccasions();
  return all.find((o) => o.slug === slug) ?? null;
}

/** Full product page data. Availability per variant is live (short cache). */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG, `product:${slug}`);

  const supabase = createPublicClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      `id, slug, name, short_description, description, care_instructions, is_best_seller, is_featured,
       seo_title, seo_description, published_at,
       collections ( slug, name ),
       product_variants ( id, sku, name, price_centavos, compare_at_price_centavos, is_default, is_active, position ),
       product_images ( storage_path, alt_text, width, height, position ),
       product_occasions ( occasions ( slug, name ) ),
       product_tags ( tags ( slug, name ) ),
       product_add_ons ( max_quantity, position, add_ons ( id, sku, name, description, price_centavos, image_path, is_active ) )`,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`getProductBySlug: ${error.message}`);
  if (!product) return null;

  const activeVariants = product.product_variants
    .filter((v) => v.is_active)
    .sort(
      (a, b) => Number(b.is_default) - Number(a.is_default) || a.position - b.position,
    );

  const availability = await Promise.all(
    activeVariants.map(async (v) => {
      const [{ data: label }, { data: qty }] = await Promise.all([
        supabase.rpc("variant_availability", { p_variant_id: v.id }),
        supabase.rpc("variant_available_quantity", { p_variant_id: v.id }),
      ]);
      return { label: (label as Availability | null) ?? "untracked", qty: qty ?? null };
    }),
  );

  const collectionSlug = product.collections?.slug ?? null;
  const images = [...product.product_images]
    .sort((a, b) => a.position - b.position)
    .map((img) => ({
      src: productImageSrc(img.storage_path, collectionSlug),
      alt: img.alt_text,
      width: img.width,
      height: img.height,
    }));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.short_description,
    description: product.description,
    careInstructions: product.care_instructions,
    collection: product.collections
      ? { slug: product.collections.slug, name: product.collections.name }
      : null,
    occasions: product.product_occasions.flatMap((po) =>
      po.occasions ? [po.occasions] : [],
    ),
    tags: product.product_tags.flatMap((pt) => (pt.tags ? [pt.tags] : [])),
    images: images.length
      ? images
      : [
          {
            src: productImageSrc(null, collectionSlug),
            alt: product.name,
            width: null,
            height: null,
          },
        ],
    variants: activeVariants.map((v, i) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      priceCentavos: v.price_centavos,
      compareAtPriceCentavos: v.compare_at_price_centavos,
      isDefault: v.is_default,
      availability: availability[i]!.label,
      availableQuantity: availability[i]!.qty,
    })),
    addOns: product.product_add_ons
      .filter((pa) => pa.add_ons?.is_active)
      .sort((a, b) => a.position - b.position)
      .map((pa) => ({
        id: pa.add_ons!.id,
        sku: pa.add_ons!.sku,
        name: pa.add_ons!.name,
        description: pa.add_ons!.description,
        priceCentavos: pa.add_ons!.price_centavos,
        maxQuantity: pa.max_quantity,
        image: storagePublicUrl("product-images", pa.add_ons!.image_path),
      })),
    isBestSeller: product.is_best_seller,
    isFeatured: product.is_featured,
    seoTitle: product.seo_title,
    seoDescription: product.seo_description,
    publishedAt: product.published_at,
  };
}

/** Slugs for sitemap / static params. */
export async function listProductSlugs(): Promise<
  { slug: string; updatedAt: string | null }[]
> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const { data } = await createPublicClient()
    .from("products")
    .select("slug, updated_at")
    .eq("status", "active");
  return (data ?? []).map((p) => ({ slug: p.slug, updatedAt: p.updated_at }));
}
