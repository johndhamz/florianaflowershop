import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { ProductCard } from "@/components/shared/product-card";
import { Button } from "@/components/ui/button";
import type { ProductSummary } from "@/modules/catalog/types";

type ProductGridProps = {
  products: ProductSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
  resetHref?: string;
  priorityCount?: number;
};

export function ProductGrid({
  products,
  emptyTitle = "No flowers match those filters",
  emptyDescription = "Try a different search, widen the price range, or browse the full shop.",
  resetHref = "/shop",
  priorityCount = 3,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Button variant="outline" asChild>
            <Link href={resetHref}>Clear filters</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3"
      aria-label="Products"
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
