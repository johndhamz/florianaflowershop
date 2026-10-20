import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { aboutSchema, getContent } from "@/modules/content/queries";

export const metadata: Metadata = {
  title: "Our story",
  description:
    "Floriana Flowers is named after the owner's lola, Floriana, 86, who still loves caring for her orchids.",
  alternates: { canonical: "/our-story" },
};

export default async function OurStoryPage() {
  const about = await getContent("about.story", aboutSchema);
  const paragraphs = about?.paragraphs ?? [
    "Floriana Flowers is named after the owner's lola, Floriana, who is 86 years old and continues to love caring for her orchids.",
    "We are a small, delivery-first flower studio in Cebu. We pair affordable everyday flowers with premium bouquets, orchid gifts and elegant arrangements.",
  ];

  return (
    <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <div className="relative aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] ring-1 ring-foreground/5">
        <Image
          src="/images/placeholders/orchid.jpg"
          alt="Orchid in a ceramic pot"
          fill
          priority
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-cover"
        />
      </div>
      <article className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.18em] text-sage-600 uppercase">
          Our story
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
          {about?.title ?? "Our story"}
        </h1>
        <div className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-foreground/90">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/collections/lolas-orchid-collection">
              Lola&apos;s Orchid Collection
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/shop">Shop all flowers</Link>
          </Button>
        </div>
      </article>
    </Container>
  );
}
