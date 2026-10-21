import {
  ArrowRightIcon,
  ClockIcon,
  HeartHandshakeIcon,
  LeafIcon,
  TruckIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/shared/container";
import { ProductCard } from "@/components/shared/product-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { StatusBadge } from "@/components/shared/status-badge";
import { CollectionCard } from "@/components/storefront/collection-card";
import { CoverageChecker } from "@/components/storefront/coverage-checker";
import { JsonLd } from "@/components/storefront/json-ld";
import { ReviewsSection } from "@/components/storefront/reviews-section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { storagePublicUrl } from "@/lib/supabase/storage";
import {
  listBestSellers,
  listCollectionProducts,
  listCollections,
} from "@/modules/catalog/queries";
import {
  getBusinessSettings,
  getContent,
  heroSchema,
  storySchema,
} from "@/modules/content/queries";
import { listApprovedReviews } from "@/modules/reviews/queries";

const promises = [
  {
    icon: TruckIcon,
    title: "Delivered across Cebu",
    body: "Configurable zones and time slots so your flowers arrive when it matters.",
  },
  {
    icon: LeafIcon,
    title: "Fresh, tracked stock",
    body: "Every stem is batch-dated. We never ship blooms past their best.",
  },
  {
    icon: HeartHandshakeIcon,
    title: "Cared for like Lola's",
    body: "Conditioned, wrapped and handled the way Floriana taught us.",
  },
] as const;

export default async function HomePage() {
  const [hero, story, collections, bestSellers, orchids, reviews, settings] =
    await Promise.all([
      getContent("home.hero", heroSchema),
      getContent("home.story", storySchema),
      listCollections(),
      listBestSellers(4),
      listCollectionProducts("lolas-orchid-collection", 3),
      listApprovedReviews({ limit: 3 }),
      getBusinessSettings(),
    ]);

  const heroImage =
    storagePublicUrl("content-media", hero?.image_path) ??
    "/images/placeholders/hero.jpg";
  const storyImage =
    storagePublicUrl("content-media", story?.image_path) ??
    "/images/placeholders/orchid.jpg";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Florist",
          name: settings.shop_name,
          url: siteConfig.url,
          telephone: settings.contact_phone,
          email: settings.contact_email,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Cebu City",
            addressRegion: "Cebu",
            addressCountry: "PH",
          },
          priceRange: "₱₱",
          sameAs: Object.values(settings.social),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div className="max-w-xl animate-fade-up">
            <StatusBadge tone="brand" dot={false} className="mb-5">
              <ClockIcon aria-hidden className="size-3.5" />
              {hero?.eyebrow ?? "Same-day delivery before 2 PM"}
            </StatusBadge>
            <h1 className="font-serif text-5xl leading-[1.02] font-semibold text-cocoa sm:text-6xl lg:text-7xl">
              {hero?.title ?? siteConfig.tagline}
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground sm:text-lg">
              {hero?.body ??
                "Everyday flowers, premium bouquets and orchid gifts from a small Cebu studio named after an 86-year-old lola who still tends her orchids each morning."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-11 px-6 text-base" asChild>
                <Link href={hero?.cta_primary.href ?? "/shop"}>
                  {hero?.cta_primary.label ?? "Shop flowers"}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
              {hero?.cta_secondary ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-6 text-base"
                  asChild
                >
                  <Link href={hero.cta_secondary.href}>{hero.cta_secondary.label}</Link>
                </Button>
              ) : null}
            </div>
            <p className="mt-6 text-xs tracking-wide text-muted-foreground uppercase">
              Prices in Philippine Peso · {siteConfig.location}
            </p>
          </div>
          <div className="relative mx-auto aspect-[6/7] w-full max-w-md lg:max-w-none">
            <div
              className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-blush-100/70 blur-2xl"
              aria-hidden
            />
            <Image
              src={heroImage}
              alt="Blush and sage bouquet"
              fill
              priority
              fetchPriority="high"
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="rounded-[2rem] object-cover ring-1 ring-foreground/5"
            />
          </div>
        </Container>
      </section>

      {/* Coverage checker */}
      <section
        aria-label="Delivery coverage"
        className="border-y border-border/70 bg-ivory-100"
      >
        <Container className="py-10 sm:py-12">
          <CoverageChecker className="mx-auto max-w-3xl" />
        </Container>
      </section>

      {/* Collections */}
      <section aria-labelledby="collections-heading">
        <Container className="py-12 sm:py-16">
          <SectionHeading
            eyebrow="Collections"
            title="Flowers for every occasion and every ordinary Tuesday"
            description="Affordable everyday blooms sit beside our premium pieces. Pick what fits the moment."
            action={
              <Button variant="link" className="px-0" asChild>
                <Link href="/shop">
                  Shop all
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            }
          />
          <h2 id="collections-heading" className="sr-only">
            Featured collections
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {collections.map((c, i) => (
              <li key={c.id}>
                <CollectionCard collection={c} priority={i < 2} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Best sellers */}
      {bestSellers.length > 0 ? (
        <section
          aria-label="Best sellers"
          className="border-y border-border/70 bg-ivory-100"
        >
          <Container className="py-12 sm:py-16">
            <SectionHeading
              eyebrow="Most loved"
              title="Best sellers"
              description="The bouquets and orchids Cebu keeps coming back for."
            />
            <ul
              className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4"
              aria-label="Best sellers"
            >
              {bestSellers.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Story */}
      <section aria-labelledby="story-heading">
        <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <div className="relative order-2 aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] ring-1 ring-foreground/5 lg:order-1">
            <Image
              src={storyImage}
              alt="Orchid in a ceramic pot"
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
            />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-medium tracking-[0.18em] text-sage-600 uppercase">
              {story?.eyebrow ?? "Our story"}
            </p>
            <h2
              id="story-heading"
              className="mt-3 font-serif text-3xl font-semibold sm:text-4xl"
            >
              {story?.title ?? "Named after Lola Floriana, 86, and her orchids"}
            </h2>
            <p className="mt-5 text-muted-foreground">
              {story?.body ??
                "Floriana is the owner's lola. At 86 she still loves caring for her orchids. We started Floriana Flowers to share that same patience with Cebu."}
            </p>
            <Button variant="outline" className="mt-7" asChild>
              <Link href={story?.cta?.href ?? "/our-story"}>
                {story?.cta?.label ?? "Read our story"}
              </Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* Orchid spotlight */}
      {orchids.length > 0 ? (
        <section aria-labelledby="orchids-heading" className="bg-sage-700 text-ivory">
          <Container className="py-12 sm:py-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="mb-2 text-xs font-medium tracking-[0.18em] text-ivory/85 uppercase">
                  Lola&apos;s Orchid Collection
                </p>
                <h2
                  id="orchids-heading"
                  className="font-serif text-2xl font-semibold sm:text-3xl"
                >
                  Living gifts that keep blooming
                </h2>
                <p className="mt-2 text-sm text-ivory/80 sm:text-base">
                  Chosen the way Lola chooses hers: healthy roots, strong spikes, buds
                  still to open.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-ivory/40 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory"
                asChild
              >
                <Link href="/collections/lolas-orchid-collection">
                  See all orchids
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            </div>
            <ul
              className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3 [&_article_p]:text-ivory/85 [&_article_span:not([data-slot=status-badge])]:text-ivory"
              aria-label="Orchid gifts"
            >
              {orchids.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Promise */}
      <section aria-labelledby="promise-heading">
        <Container className="py-12 sm:py-16">
          <h2 id="promise-heading" className="sr-only">
            Why Floriana
          </h2>
          <ul className="grid gap-8 md:grid-cols-3">
            {promises.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-serif text-xl font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Reviews */}
      <section className="border-t border-border/70 bg-ivory-100">
        <Container className="py-12 sm:py-16">
          <ReviewsSection reviews={reviews} />
        </Container>
      </section>
    </>
  );
}
