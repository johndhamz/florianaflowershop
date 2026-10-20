import { ChevronDownIcon } from "lucide-react";

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y rounded-2xl bg-card ring-1 ring-foreground/10">
      {items.map((item, i) => (
        <details key={i} className="group/faq px-5 py-4" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDownIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open/faq:rotate-180"
            />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
