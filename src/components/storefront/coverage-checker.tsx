"use client";

import { CheckCircle2Icon, Loader2Icon, MapPinIcon, XCircleIcon } from "lucide-react";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCentavos } from "@/lib/money";
import { cn } from "@/lib/utils";
import { checkCoverage, type CoverageResult } from "@/modules/delivery/actions";

function formatCutoff(time: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const hour12 = ((h! + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${h! >= 12 ? "PM" : "AM"}`;
}

export function CoverageChecker({ className }: { className?: string }) {
  const id = useId();
  const [result, action, pending] = useActionState<CoverageResult | null, FormData>(
    checkCoverage,
    null,
  );

  return (
    <div
      className={cn(
        "rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MapPinIcon aria-hidden className="size-5" />
        </span>
        <div>
          <h3 className="font-serif text-xl font-semibold">Do we deliver to you?</h3>
          <p className="text-sm text-muted-foreground">
            Type your barangay or city to check coverage, fees and cutoffs.
          </p>
        </div>
      </div>
      <form
        action={action}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        aria-busy={pending}
      >
        <div className="flex-1">
          <Label htmlFor={`${id}-q`} className="sr-only">
            Barangay or city
          </Label>
          <Input
            id={`${id}-q`}
            name="q"
            placeholder="e.g. Lahug, Mandaue, Talamban"
            className="h-11 bg-background"
            autoComplete="address-level3"
            required
            minLength={3}
          />
        </div>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          Check coverage
        </Button>
      </form>

      <div aria-live="polite" className="mt-4">
        {result && !result.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        ) : null}
        {result?.ok && result.matches.length === 0 ? (
          <p className="flex items-start gap-2 text-sm">
            <XCircleIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            <span>
              We don&apos;t deliver to “{result.query}” yet. We cover Cebu City, Mandaue,
              Lapu-Lapu, Talisay, Minglanilla, Consolacion and Liloan.
            </span>
          </p>
        ) : null}
        {result?.ok && result.matches.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {result.matches.map((m) => {
              const cutoff = formatCutoff(m.sameDayCutoff);
              return (
                <li
                  key={m.zoneId}
                  className="flex items-start gap-2 rounded-xl bg-accent/60 p-3 text-sm"
                >
                  <CheckCircle2Icon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-success"
                  />
                  <div>
                    <p className="font-medium">
                      Yes, we deliver to{" "}
                      {m.matchedBarangay ? `${m.matchedBarangay}, ` : ""}
                      {m.city}
                    </p>
                    <p className="text-muted-foreground">
                      Delivery {formatCentavos(m.feeCentavos)}
                      {m.freeDeliveryThresholdCentavos
                        ? ` · free over ${formatCentavos(m.freeDeliveryThresholdCentavos)}`
                        : ""}
                      {cutoff
                        ? ` · same-day before ${cutoff}`
                        : ` · ${m.leadTimeHours}h lead time`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
