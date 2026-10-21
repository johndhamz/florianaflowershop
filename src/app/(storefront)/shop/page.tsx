import type { Metadata } from "next";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { Pagination } from "@/components/storefront/pagination";
import { ProductGrid } from "@/components/storefront/product-grid";
import { listCollections, listOccasions, listProducts } from "@/modules/catalog/queries";
import { parseCatalogSearchParams } from "@/modules/catalog/search-params";

export const metadata: Metadata = {
  title: "All Flowers",
  description:
    "Browse every bouquet, orchid and arrangement we deliver across Cebu. Filter by collection, occasion and price.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const params = parseCatalogSearchParams(await searchParams);
  const [page, collections, occasions] = await Promise.all([
    listProducts(params),
    listCollections(),
    listOccasions(),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Shop"
        title="All flowers"
        description="Everyday bunches, premium bouquets, orchid gifts and arrangements. Delivered fresh across Cebu."
      />
      <CatalogFilters
        params={params}
        collections={collections}
        occasions={occasions}
        resultCount={page.total}
      />
      <h2 className="sr-only">Products</h2>
      <ProductGrid products={page.items} />
      <Pagination params={params} pageCount={page.pageCount} basePath="/shop" />
    </Container>
  );
}
