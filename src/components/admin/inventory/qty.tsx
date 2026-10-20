import { cn } from "@/lib/utils";

const UNIT_LABEL: Record<string, string> = {
  stem: "stems",
  bunch: "bunches",
  piece: "pcs",
  gram: "g",
  millilitre: "ml",
  metre: "m",
};

export function Qty({
  value,
  unit,
  className,
}: {
  value: number | string;
  unit?: string | null;
  className?: string;
}) {
  const n = typeof value === "number" ? value : Number(value);
  const text = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
  return (
    <span className={cn("tabular-nums", className)}>
      {text}
      {unit ? (
        <span className="text-muted-foreground"> {UNIT_LABEL[unit] ?? unit}</span>
      ) : null}
    </span>
  );
}

export function unitLabel(unit: string | null | undefined) {
  return unit ? (UNIT_LABEL[unit] ?? unit) : "";
}
