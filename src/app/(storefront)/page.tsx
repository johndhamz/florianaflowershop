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
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  sampleProducts,
} from "@/modules/catalog";

const categoryCopy = {
  everyday: { blurb: "Market-fresh bunches for any day of the week.", from: "from ₱450" },
  bouquets: {
    blurb: "Hand-tied, wrapped and finished for the big moments.",
    from: "from ₱1,890",
  },
  orchids: {
    blurb: "Living gifts that keep blooming, Lola's favourite.",
    from: "from ₱1,290",
  },
  arrangements: {
    blurb: "Vase and table pieces styled for homes and events.",
    from: "from ₱2,400",
  },
} as const;

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

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div className="max-w-xl animate-fade-up">
            <StatusBadge tone="brand" dot={false} className="mb-5">
              <ClockIcon aria-hidden className="size-3.5" />
              Same-day delivery before 2 PM
            </StatusBadge>
            <h1 className="font-serif text-5xl leading-[1.02] font-semibold text-cocoa sm:text-6xl lg:text-7xl">
              Love, in every <em className="font-normal text-sage-600 italic">bloom</em>.
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground sm:text-lg">
              Everyday flowers, premium bouquets and orchid gifts from a small Cebu studio
              named after an 86-year-old lola who still tends her orchids each morning.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-11 px-6 text-base" asChild>
                <Link href="/shop">
                  Shop bouquets
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-6 text-base" asChild>
                <Link href="/shop/orchids">Orchid gifts</Link>
              </Button>
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
              src="/images/placeholders/hero.svg"
              alt="Blush and sage bouquet illustration"
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="rounded-[2rem] object-cover ring-1 ring-foreground/5"
            />
          </div>
        </Container>
      </section>

      {/* Categories */}
      <section
        aria-labelledby="categories-heading"
        className="border-y border-border/70 bg-ivory-100"
      >
        <Container className="py-12 sm:py-16">
          <SectionHeading
            eyebrow="Collections"
            title="Flowers for every occasion and every ordinary Tuesday"
            description="Affordable everyday blooms sit beside our premium pieces. Pick what fits the moment."
          />
          <h2 id="categories-heading" className="sr-only">
            Shop by collection
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCT_CATEGORIES.map((category) => (
              <li key={category}>
                <Link
                  href={`/shop/${category}`}
                  className="group/cat flex h-full flex-col justify-between rounded-2xl bg-card p-5 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div>
                    <h3 className="font-serif text-xl font-semibold">
                      {PRODUCT_CATEGORY_LABELS[category]}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {categoryCopy[category].blurb}
                    </p>
                  </div>
                  <p className="mt-6 flex items-center justify-between text-sm">
                    <span className="text-sage-700">{categoryCopy[category].from}</span>
                    <ArrowRightIcon
                      aria-hidden
                      className="size-4 text-muted-foreground transition-transform group-hover/cat:translate-x-0.5"
                    />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Featured products */}
      <section aria-labelledby="featured-heading">
        <Container className="py-12 sm:py-16">
          <SectionHeading
            eyebrow="This week"
            title="Featured blooms"
            description="A taste of the catalog. Full shop, filters and search arrive in the next phase."
            action={
              <Button variant="link" className="px-0" asChild>
                <Link href="/shop">
                  View all
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            }
          />
          <h2 id="featured-heading" className="sr-only">
            Featured products
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3">
            {sampleProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 3} />
            ))}
          </div>
        </Container>
      </section>

      {/* Promise */}
      <section aria-labelledby="promise-heading" className="bg-sage-700 text-ivory">
        <Container className="py-12 sm:py-16">
          <h2 id="promise-heading" className="sr-only">
            Why Floriana
          </h2>
          <ul className="grid gap-8 md:grid-cols-3">
            {promises.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ivory/10 ring-1 ring-ivory/20">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-serif text-xl font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ivory/80">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Story */}
      <section aria-labelledby="story-heading">
        <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <div className="relative order-2 aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] ring-1 ring-foreground/5 lg:order-1">
            <Image
              src="/images/placeholders/orchid.svg"
              alt="Orchid illustration in blush tones"
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
            />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-medium tracking-[0.18em] text-sage-600 uppercase">
              Our story
            </p>
            <h2
              id="story-heading"
              className="mt-3 font-serif text-3xl font-semibold sm:text-4xl"
            >
              Named after Lola Floriana, 86, and her orchids
            </h2>
            <p className="mt-5 text-muted-foreground">
              Every morning she checks the roots, mists the leaves and talks to the
              blooms. We started Floriana Flowers to share that patience with Cebu: honest
              everyday bunches, elegant bouquets, and orchid gifts that outlast the
              occasion.
            </p>
            <Button variant="outline" className="mt-7" asChild>
              <Link href="/about">Read the full story</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* Delivery CTA */}
      <section
        aria-labelledby="delivery-heading"
        className="border-t border-border/70 bg-blush-100/60"
      >
        <Container className="flex flex-col items-start gap-6 py-12 sm:py-14 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2
              id="delivery-heading"
              className="font-serif text-2xl font-semibold sm:text-3xl"
            >
              Delivering across Cebu, on your schedule
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Check which zones we cover and pick a time slot that suits the recipient.
              Guest checkout, no account needed.
            </p>
          </div>
          <Button size="lg" className="h-11 px-6" asChild>
            <Link href="/delivery">
              See delivery zones
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </Container>
      </section>
    </>
  );
}
