import { MessageSquareHeartIcon, StarIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { formatManila } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { Review, ReviewSummary } from "@/modules/reviews/queries";

type ReviewsSectionProps = {
  reviews: Review[];
  summary?: ReviewSummary;
  title?: string;
  description?: string;
  compact?: boolean;
};

/**
 * Shows only real, approved reviews. When there are none, it says so plainly
 * rather than inventing testimonials.
 */
export function ReviewsSection({
  reviews,
  summary,
  title = "What customers say",
  description,
  compact = false,
}: ReviewsSectionProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-6">
      <SectionHeading
        title={title}
        description={
          description ??
          (summary?.count
            ? `${summary.count} verified ${summary.count === 1 ? "review" : "reviews"} · ${summary.average?.toFixed(1)} out of 5`
            : undefined)
        }
        as="h2"
      />
      {reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareHeartIcon}
          size="sm"
          title="No reviews yet"
          description="We only publish reviews from customers who ordered. The first ones will appear here."
        />
      ) : (
        <ul className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "md:grid-cols-3")}>
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
            >
              <Stars rating={review.rating} />
              {review.title ? (
                <h3 className="font-serif text-lg font-semibold">{review.title}</h3>
              ) : null}
              <p className="text-sm text-foreground/90">{review.body}</p>
              <p className="mt-auto text-xs text-muted-foreground">
                {review.reviewerName} ·{" "}
                {formatManila(review.createdAt, { dateStyle: "medium" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <p className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          aria-hidden
          className={cn(
            "size-4",
            i < rating ? "fill-blush-400 text-blush-400" : "text-border",
          )}
        />
      ))}
    </p>
  );
}
