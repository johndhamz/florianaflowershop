import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";

export type Review = {
  id: string;
  productId: string;
  reviewerName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
};

export type ReviewSummary = { count: number; average: number | null };

/** Approved reviews only. Nothing is ever fabricated: an empty list is shown as such. */
export async function listApprovedReviews(
  opts: { productId?: string; limit?: number } = {},
): Promise<Review[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("reviews");
  let query = createPublicClient()
    .from("product_reviews")
    .select("id, product_id, reviewer_name, rating, title, body, created_at")
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 6);
  if (opts.productId) query = query.eq("product_id", opts.productId);
  const { data, error } = await query;
  if (error) throw new Error(`product_reviews: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    reviewerName: r.reviewer_name,
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  "use cache";
  cacheLife("hours");
  cacheTag("reviews");
  const { data, error } = await createPublicClient()
    .from("product_reviews")
    .select("rating")
    .eq("is_approved", true)
    .eq("product_id", productId);
  if (error) throw new Error(`product_reviews summary: ${error.message}`);
  const ratings = (data ?? []).map((r) => r.rating);
  return {
    count: ratings.length,
    average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
  };
}
