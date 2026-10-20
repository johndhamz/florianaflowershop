import { getPublicEnv } from "@/lib/env";

export type StorageBucket = "product-images" | "content-media";

/** Public URL for an object in a public bucket (safe on the client: anon URL only). */
export function storagePublicUrl(
  bucket: StorageBucket,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const base = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`;
}

/** Local illustrative fallback per collection when a product has no image. */
export function placeholderImage(collectionSlug: string | null | undefined): string {
  switch (collectionSlug) {
    case "everyday-blooms":
      return "/images/placeholders/everyday.svg";
    case "lolas-orchid-collection":
      return "/images/placeholders/orchid.svg";
    case "arrangements":
      return "/images/placeholders/arrangement.svg";
    default:
      return "/images/placeholders/bouquet.svg";
  }
}

export function productImageSrc(
  path: string | null | undefined,
  collectionSlug?: string | null,
): string {
  return storagePublicUrl("product-images", path) ?? placeholderImage(collectionSlug);
}
