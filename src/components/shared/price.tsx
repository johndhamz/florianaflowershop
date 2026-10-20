import type { Centavos } from "@/lib/money";
import { formatCentavos } from "@/lib/money";
import { cn } from "@/lib/utils";

type PriceProps = {
  centavos: Centavos;
  compareAtCentavos?: Centavos;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = { sm: "text-sm", md: "text-base", lg: "text-xl" } as const;

/** Presentational only: money arrives as integer centavos and is formatted here. */
export function Price({
  centavos,
  compareAtCentavos,
  className,
  size = "md",
}: PriceProps) {
  const onSale = compareAtCentavos !== undefined && compareAtCentavos > centavos;
  return (
    <span className={cn("inline-flex items-baseline gap-2", sizeClass[size], className)}>
      <span className="font-medium text-cocoa tabular-nums">
        {formatCentavos(centavos)}
      </span>
      {onSale ? (
        <span className="text-muted-foreground tabular-nums line-through">
          <span className="sr-only">Original price </span>
          {formatCentavos(compareAtCentavos)}
        </span>
      ) : null}
    </span>
  );
}
