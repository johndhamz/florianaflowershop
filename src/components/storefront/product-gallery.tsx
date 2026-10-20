"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/modules/catalog/types";

export function ProductGallery({
  images,
  name,
}: {
  images: ProductDetail["images"];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const active = images[index] ?? images[0]!;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/5">
        <Image
          key={active.src}
          src={active.src}
          alt={active.alt}
          fill
          priority
          sizes="(min-width: 1024px) 48vw, 100vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={`${name} photos`}>
          {images.map((img, i) => (
            <li key={img.src + i}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-pressed={i === index}
                className={cn(
                  "relative size-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-colors outline-none focus-visible:ring-ring sm:size-20",
                  i === index ? "ring-primary" : "ring-transparent hover:ring-border",
                )}
              >
                <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
