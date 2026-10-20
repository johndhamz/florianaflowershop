import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { CollectionSummary } from "@/modules/catalog/types";

export function CollectionCard({
  collection,
  priority = false,
}: {
  collection: CollectionSummary;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group/cat relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:aspect-[3/4]"
    >
      <Image
        src={collection.image}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-700 ease-[var(--ease-bloom)] group-hover/cat:scale-[1.04]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-cocoa-800/80 via-cocoa-800/20 to-transparent"
      />
      <div className="relative p-5 text-ivory">
        <h3 className="font-serif text-2xl font-semibold">{collection.name}</h3>
        {collection.tagline ? (
          <p className="mt-1 text-sm text-ivory/85">{collection.tagline}</p>
        ) : null}
        <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
          {collection.productCount === 1
            ? "1 flower"
            : `${collection.productCount} flowers`}
          <ArrowRightIcon
            aria-hidden
            className="size-4 transition-transform group-hover/cat:translate-x-0.5"
          />
        </p>
      </div>
    </Link>
  );
}
