import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { Pagination } from "@/components/storefront/pagination";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getOccasion,
  listCollections,
  listOccasions,
  listProducts,
} from "@/modules/catalog/queries";
import { parseCatalogSearchParams } from "@/modules/catalog/search-params";

export async function generateMetadata({
  params,
}: PageProps<"/occasions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await getOccasion(slug);
  if (!occasion) return { title: "Occasion not found" };
  return {
    title: `${occasion.name} flowers`,
    description: occasion.description ?? undefined,
    alternates: { canonical: `/occasions/${occasion.slug}` },
  };
}

export default async function OccasionPage({
  params,
  searchParams,
}: PageProps<"/occasions/[slug]">) {
  const { slug } = await params;
  const occasion = await getOccasion(slug);
  if (!occasion) notFound();

  const basePath = `/occasions/${slug}`;
  const query = { ...parseCatalogSearchParams(await searchParams), occasion: slug };
  const [page, collections, occasions] = await Promise.all([
    listProducts(query),
    listCollections(),
    listOccasions(),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <Breadcrumbs
        items={[{ label: "Occasions", href: "/occasions" }, { label: occasion.name }]}
      />
      <PageHeader
        eyebrow="Occasion"
        title={`${occasion.name} flowers`}
        description={occasion.description ?? undefined}
      />
      <CatalogFilters
        params={query}
        collections={collections}
        occasions={occasions}
        basePath={basePath}
        lock="occasion"
        resultCount={page.total}
      />
      <h2 className="sr-only">Products</h2>
      <ProductGrid products={page.items} resetHref={basePath} />
      <Pagination params={query} pageCount={page.pageCount} basePath={basePath} />
    </Container>
  );
}
