import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import {
  listCollections,
  listOccasions,
  listProductSlugs,
} from "@/modules/catalog/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections, occasions] = await Promise.all([
    listProductSlugs(),
    listCollections(),
    listOccasions(),
  ]);
  const base = siteConfig.url;
  const statics = [
    "",
    "/shop",
    "/occasions",
    "/our-story",
    "/delivery",
    "/faqs",
    "/contact",
    "/privacy",
  ];
  return [
    ...statics.map((path) => ({
      url: `${base}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...collections.map((c) => ({
      url: `${base}/collections/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...occasions.map((o) => ({
      url: `${base}/occasions/${o.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...products.map((p) => ({
      url: `${base}/shop/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
