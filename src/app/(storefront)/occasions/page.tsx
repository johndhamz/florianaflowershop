import type { Metadata } from "next";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { listOccasions } from "@/modules/catalog/queries";

export const metadata: Metadata = {
  title: "Occasions",
  description:
    "Flowers for birthdays, anniversaries, sympathy, congratulations, get-well wishes and just because.",
  alternates: { canonical: "/occasions" },
};

export default async function OccasionsPage() {
  const occasions = await listOccasions();
  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Occasions"
        title="Say it with the right flowers"
        description="Start from the moment, and we will show you what fits."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {occasions.map((o) => (
          <li key={o.id}>
            <Link
              href={`/occasions/${o.slug}`}
              className="group/occ flex h-full flex-col justify-between rounded-2xl bg-card p-5 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div>
                <h2 className="font-serif text-xl font-semibold">{o.name}</h2>
                {o.description ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">{o.description}</p>
                ) : null}
              </div>
              <p className="mt-6 flex items-center justify-between text-sm text-sage-700">
                Browse
                <ArrowRightIcon
                  aria-hidden
                  className="size-4 transition-transform group-hover/occ:translate-x-0.5"
                />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
