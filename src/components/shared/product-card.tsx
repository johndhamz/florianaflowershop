import Image from "next/image";
import Link from "next/link";

import { Price } from "@/components/shared/price";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { PRODUCT_CATEGORY_LABELS, type ProductSummary } from "@/modules/catalog";

type ProductCardProps = {
  product: ProductSummary;
  className?: string;
  /** Load eagerly for above-the-fold cards. */
  priority?: boolean;
};

const badgeLabel: Record<NonNullable<ProductSummary["badge"]>, string> = {
  new: "New",
  bestseller: "Bestseller",
  limited: "Limited",
};

export function ProductCard({ product, className, priority = false }: ProductCardProps) {
  const href = `/shop/${product.slug}`;
  const soldOut = product.availability === "out_of_stock";

  return (
    <article
      data-slot="product-card"
      className={cn("group/product relative flex flex-col gap-3", className)}
      aria-labelledby={`product-${product.id}-name`}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/5">
        <Image
          src={product.image.src}
          alt={product.image.alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 33vw, 50vw"
          className={cn(
            "object-cover transition-transform duration-700 ease-[var(--ease-bloom)] group-hover/product:scale-[1.03]",
            soldOut && "opacity-70 saturate-50",
          )}
        />
        {product.badge ? (
          <StatusBadge
            tone="brand"
            dot={false}
            className="absolute top-3 left-3 shadow-sm"
          >
            {badgeLabel[product.badge]}
          </StatusBadge>
        ) : null}
        {soldOut ? (
          <StatusBadge
            tone="neutral"
            dot={false}
            className="absolute top-3 right-3 shadow-sm"
          >
            Sold out
          </StatusBadge>
        ) : product.availability === "low_stock" ? (
          <StatusBadge
            tone="warning"
            dot
            className="absolute top-3 right-3 bg-card shadow-sm"
          >
            Few left
          </StatusBadge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {PRODUCT_CATEGORY_LABELS[product.category]}
        </p>
        <h3
          id={`product-${product.id}-name`}
          className="font-serif text-lg leading-tight font-semibold"
        >
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {product.name}
          </Link>
        </h3>
        <Price
          centavos={product.priceCentavos}
          compareAtCentavos={product.compareAtPriceCentavos}
          size="sm"
        />
      </div>
    </article>
  );
}
