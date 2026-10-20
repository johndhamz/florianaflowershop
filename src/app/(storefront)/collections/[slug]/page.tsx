import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { Pagination } from "@/components/storefront/pagination";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getCollection,
  listCollections,
  listOccasions,
  listProducts,
} from "@/modules/catalog/queries";
import { parseCatalogSearchParams } from "@/modules/catalog/search-params";

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.name,
    description: collection.description ?? collection.tagline ?? undefined,
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  const basePath = `/collections/${slug}`;
  const query = { ...parseCatalogSearchParams(await searchParams), collection: slug };
  const [page, collections, occasions] = await Promise.all([
    listProducts(query),
    listCollections(),
    listOccasions(),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <Breadcrumbs
        items={[{ label: "Shop", href: "/shop" }, { label: collection.name }]}
      />
      <PageHeader
        eyebrow="Collection"
        title={collection.name}
        description={collection.description ?? collection.tagline ?? undefined}
      />
      <CatalogFilters
        params={query}
        collections={collections}
        occasions={occasions}
        basePath={basePath}
        lock="collection"
        resultCount={page.total}
      />
      <ProductGrid products={page.items} resetHref={basePath} />
      <Pagination params={query} pageCount={page.pageCount} basePath={basePath} />
    </Container>
  );
}
