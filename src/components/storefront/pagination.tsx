import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildCatalogHref,
  type CatalogSearchParams,
} from "@/modules/catalog/search-params";

type PaginationProps = {
  params: CatalogSearchParams;
  pageCount: number;
  basePath: string;
};

export function Pagination({ params, pageCount, basePath }: PaginationProps) {
  if (pageCount <= 1) return null;
  const { page } = params;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <PageLink
        href={buildCatalogHref({ ...params, page: page - 1 }, basePath)}
        disabled={page <= 1}
        label="Previous page"
      >
        <ChevronLeftIcon />
      </PageLink>
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && pages[i - 1]! < p - 1 ? (
            <span className="px-1 text-muted-foreground" aria-hidden>
              …
            </span>
          ) : null}
          <PageLink
            href={buildCatalogHref({ ...params, page: p }, basePath)}
            current={p === page}
            label={`Page ${p}`}
          >
            {p}
          </PageLink>
        </span>
      ))}
      <PageLink
        href={buildCatalogHref({ ...params, page: page + 1 }, basePath)}
        disabled={page >= pageCount}
        label="Next page"
      >
        <ChevronRightIcon />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  current,
  label,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(
    buttonVariants({ variant: current ? "default" : "ghost", size: "icon" }),
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return (
      <span className={className} aria-disabled aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={className}
      aria-label={label}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
