import type { Metadata } from "next";
import { LeafIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { Container } from "@/components/shared/container";
import { ProductCard } from "@/components/shared/product-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddToCartForm } from "@/components/storefront/add-to-cart-form";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { JsonLd } from "@/components/storefront/json-ld";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ReviewsSection } from "@/components/storefront/reviews-section";
import { siteConfig } from "@/config/site";
import { getProductBySlug, listCollectionProducts } from "@/modules/catalog/queries";
import { getReviewSummary, listApprovedReviews } from "@/modules/reviews/queries";

export async function generateMetadata({
  params,
}: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const description =
    product.seoDescription ??
    product.shortDescription ??
    product.description?.slice(0, 155) ??
    undefined;
  return {
    title: product.seoTitle ?? product.name,
    description,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      images: product.images.slice(0, 1).map((img) => ({ url: img.src, alt: img.alt })),
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, reviews, summary] = await Promise.all([
    product.collection
      ? listCollectionProducts(product.collection.slug, 5)
      : Promise.resolve([]),
    listApprovedReviews({ productId: product.id, limit: 4 }),
    getReviewSummary(product.id),
  ]);
  const relatedProducts = related.filter((p) => p.id !== product.id).slice(0, 4);
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const inStock = product.variants.some((v) => v.availability !== "out_of_stock");

  return (
    <Container className="flex flex-col gap-12 py-8 sm:py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.shortDescription ?? product.description ?? undefined,
          image: product.images.map((i) => i.src),
          sku: defaultVariant?.sku,
          brand: { "@type": "Brand", name: siteConfig.name },
          url: `${siteConfig.url}/shop/${product.slug}`,
          ...(summary.count > 0 && summary.average
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: summary.average.toFixed(1),
                  reviewCount: summary.count,
                },
              }
            : {}),
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "PHP",
            lowPrice: (
              Math.min(...product.variants.map((v) => v.priceCentavos)) / 100
            ).toFixed(2),
            highPrice: (
              Math.max(...product.variants.map((v) => v.priceCentavos)) / 100
            ).toFixed(2),
            offerCount: product.variants.length,
            availability: inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Shop",
              item: `${siteConfig.url}/shop`,
            },
            ...(product.collection
              ? [
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: product.collection.name,
                    item: `${siteConfig.url}/collections/${product.collection.slug}`,
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: product.collection ? 3 : 2,
              name: product.name,
            },
          ],
        }}
      />

      <Breadcrumbs
        items={[
          { label: "Shop", href: "/shop" },
          ...(product.collection
            ? [
                {
                  label: product.collection.name,
                  href: `/collections/${product.collection.slug}`,
                },
              ]
            : []),
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {product.isBestSeller ? (
                <StatusBadge tone="brand" dot={false}>
                  Bestseller
                </StatusBadge>
              ) : null}
              {product.occasions.map((o) => (
                <StatusBadge key={o.slug} tone="neutral" dot={false}>
                  {o.name}
                </StatusBadge>
              ))}
            </div>
            <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
              {product.name}
            </h1>
            {product.shortDescription ? (
              <p className="mt-3 text-muted-foreground">{product.shortDescription}</p>
            ) : null}
          </div>

          <AddToCartForm product={product} />

          {product.description ? (
            <section aria-labelledby="about-heading" className="border-t pt-6">
              <h2 id="about-heading" className="font-serif text-xl font-semibold">
                About this piece
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                {product.description}
              </p>
            </section>
          ) : null}

          {product.careInstructions ? (
            <section
              aria-labelledby="care-heading"
              className="rounded-2xl bg-accent/60 p-5"
            >
              <h2
                id="care-heading"
                className="flex items-center gap-2 font-serif text-xl font-semibold"
              >
                <LeafIcon aria-hidden className="size-5 text-sage-600" />
                Care instructions
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                {product.careInstructions}
              </p>
            </section>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Delivered across Cebu · Stock confirmed at checkout · Guest checkout, no
            account needed
          </p>
        </div>
      </div>

      <ReviewsSection reviews={reviews} summary={summary} title="Reviews" compact />

      {relatedProducts.length > 0 ? (
        <section aria-labelledby="related-heading" className="border-t pt-10">
          <SectionHeading title={`More from ${product.collection?.name ?? "the shop"}`} />
          <h2 id="related-heading" className="sr-only">
            Related products
          </h2>
          <ul
            className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4"
            aria-label="Related products"
          >
            {relatedProducts.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
