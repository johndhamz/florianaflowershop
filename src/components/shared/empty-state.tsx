import type { LucideIcon } from "lucide-react";
import { FlowerIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Primary / secondary actions (buttons or links). */
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md";
};

export function EmptyState({
  title,
  description,
  icon: Icon = FlowerIcon,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 text-center",
        size === "md" ? "px-6 py-12" : "px-4 py-8",
        className,
      )}
    >
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <h3 className="font-serif text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
