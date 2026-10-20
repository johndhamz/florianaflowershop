import { z } from "zod";

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const pesos = z.coerce.number().int().min(0).max(1_000_000).optional().catch(undefined);

export const catalogSearchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v.length ? v : undefined))
    .optional()
    .catch(undefined),
  collection: slug.optional().catch(undefined),
  occasion: slug.optional().catch(undefined),
  /** Whole pesos, as typed by the shopper. */
  min: pesos,
  max: pesos,
  sort: z
    .enum(SORT_OPTIONS.map((o) => o.value) as [SortValue, ...SortValue[]])
    .default("featured")
    .catch("featured"),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});

export type CatalogSearchParams = z.infer<typeof catalogSearchParamsSchema>;

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses Next.js `searchParams` leniently: bad values fall back to defaults. */
export function parseCatalogSearchParams(raw: RawSearchParams): CatalogSearchParams {
  const parsed = catalogSearchParamsSchema.parse({
    q: first(raw.q),
    collection: first(raw.collection),
    occasion: first(raw.occasion),
    min: first(raw.min),
    max: first(raw.max),
    sort: first(raw.sort),
    page: first(raw.page),
  });
  if (parsed.min !== undefined && parsed.max !== undefined && parsed.min > parsed.max) {
    return { ...parsed, min: parsed.max, max: parsed.min };
  }
  return parsed;
}

/** Builds a /shop URL from params, dropping defaults so URLs stay clean. */
export function buildCatalogHref(
  params: Partial<CatalogSearchParams>,
  basePath = "/shop",
): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.collection) sp.set("collection", params.collection);
  if (params.occasion) sp.set("occasion", params.occasion);
  if (params.min !== undefined) sp.set("min", String(params.min));
  if (params.max !== undefined) sp.set("max", String(params.max));
  if (params.sort && params.sort !== "featured") sp.set("sort", params.sort);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
