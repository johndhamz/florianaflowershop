"use client";

import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  buildCatalogHref,
  type CatalogSearchParams,
  SORT_OPTIONS,
  type SortValue,
} from "@/modules/catalog/search-params";
import type { CollectionSummary, OccasionSummary } from "@/modules/catalog/types";

type CatalogFiltersProps = {
  params: CatalogSearchParams;
  collections: CollectionSummary[];
  occasions: OccasionSummary[];
  basePath?: string;
  /** Hide the collection/occasion control when the page already fixes it. */
  lock?: "collection" | "occasion";
  resultCount: number;
};

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * URL-driven filters: every control writes to the query string so results are
 * shareable, back-button friendly and rendered on the server. Works without JS
 * via the native GET form; with JS, changes navigate immediately.
 */
export function CatalogFilters({
  params,
  collections,
  occasions,
  basePath = "/shop",
  lock,
  resultCount,
}: CatalogFiltersProps) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const navigate = (next: Partial<CatalogSearchParams>) => {
    startTransition(() => {
      router.push(buildCatalogHref({ ...params, ...next, page: 1 }, basePath));
    });
  };

  const hasFilters =
    !!params.q ||
    (!lock && (!!params.collection || !!params.occasion)) ||
    params.min !== undefined ||
    params.max !== undefined;

  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-col gap-4"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const num = (key: string) => {
          const v = String(data.get(key) ?? "").trim();
          return v === "" ? undefined : Number(v);
        };
        navigate({
          q: String(data.get("q") ?? "").trim() || undefined,
          collection:
            lock === "collection"
              ? params.collection
              : String(data.get("collection") ?? "") || undefined,
          occasion:
            lock === "occasion"
              ? params.occasion
              : String(data.get("occasion") ?? "") || undefined,
          min: num("min"),
          max: num("max"),
          sort: (String(data.get("sort") ?? "featured") as SortValue) || "featured",
        });
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Label htmlFor={`${id}-q`} className="sr-only">
            Search flowers
          </Label>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={`${id}-q`}
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Search roses, orchids, sunflowers…"
            className="h-10 bg-card pl-9"
          />
        </div>
        <div className="flex gap-2">
          <div className="min-w-44 flex-1">
            <Label htmlFor={`${id}-sort`} className="sr-only">
              Sort by
            </Label>
            <select
              id={`${id}-sort`}
              name="sort"
              defaultValue={params.sort}
              className={cn(selectClass, "h-10")}
              onChange={(e) => navigate({ sort: e.target.value as SortValue })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 sm:hidden"
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            onClick={() => setOpen((v) => !v)}
          >
            <SlidersHorizontalIcon data-icon="inline-start" />
            Filters
          </Button>
          <Button type="submit" className="h-10">
            Apply
          </Button>
        </div>
      </div>

      <div
        id={`${id}-panel`}
        className={cn("grid gap-3 sm:grid-cols-4", !open && "hidden sm:grid")}
      >
        {lock !== "collection" ? (
          <div>
            <Label
              htmlFor={`${id}-collection`}
              className="mb-1.5 block text-xs text-muted-foreground"
            >
              Collection
            </Label>
            <select
              id={`${id}-collection`}
              name="collection"
              defaultValue={params.collection ?? ""}
              className={selectClass}
              onChange={(e) => navigate({ collection: e.target.value || undefined })}
            >
              <option value="">All collections</option>
              {collections.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {lock !== "occasion" ? (
          <div>
            <Label
              htmlFor={`${id}-occasion`}
              className="mb-1.5 block text-xs text-muted-foreground"
            >
              Occasion
            </Label>
            <select
              id={`${id}-occasion`}
              name="occasion"
              defaultValue={params.occasion ?? ""}
              className={selectClass}
              onChange={(e) => navigate({ occasion: e.target.value || undefined })}
            >
              <option value="">Any occasion</option>
              {occasions.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <Label
            htmlFor={`${id}-min`}
            className="mb-1.5 block text-xs text-muted-foreground"
          >
            Min price (₱)
          </Label>
          <Input
            id={`${id}-min`}
            name="min"
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            defaultValue={params.min ?? ""}
            className="h-9 bg-card"
          />
        </div>
        <div>
          <Label
            htmlFor={`${id}-max`}
            className="mb-1.5 block text-xs text-muted-foreground"
          >
            Max price (₱)
          </Label>
          <Input
            id={`${id}-max`}
            name="max"
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            defaultValue={params.max ?? ""}
            className="h-9 bg-card"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p role="status" aria-live="polite">
          {resultCount === 1 ? "1 flower" : `${resultCount} flowers`}
          {params.q ? (
            <>
              {" "}
              for <span className="font-medium text-foreground">“{params.q}”</span>
            </>
          ) : null}
        </p>
        {hasFilters ? (
          <Link
            href={lock ? basePath : buildCatalogHref({}, basePath)}
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <XIcon aria-hidden className="size-3.5" />
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
