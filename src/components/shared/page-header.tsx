import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  /** Admin pages use a compact sans-serif title for density. */
  variant?: "storefront" | "admin";
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  variant = "storefront",
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-medium tracking-[0.18em] text-sage-600 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "font-semibold text-foreground",
            variant === "storefront"
              ? "font-serif text-3xl sm:text-4xl"
              : "font-sans text-xl tracking-tight sm:text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
