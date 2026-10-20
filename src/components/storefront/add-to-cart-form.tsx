"use client";

import { Loader2Icon, MinusIcon, PlusIcon, ShoppingBagIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Price } from "@/components/shared/price";
import { AvailabilityBadge } from "@/components/storefront/availability-badge";
import { Button } from "@/components/ui/button";
import { formatCentavos } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addToCart } from "@/modules/cart/actions";
import type { ProductDetail } from "@/modules/catalog/types";

type AddToCartFormProps = { product: ProductDetail };

export function AddToCartForm({ product }: AddToCartFormProps) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState(
    () => (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [addOns, setAddOns] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  if (!variant) return null;

  const soldOut = variant.availability === "out_of_stock";
  const maxQty = Math.max(1, Math.min(50, variant.availableQuantity ?? 50));
  const addOnTotal = product.addOns.reduce(
    (sum, a) => sum + (addOns[a.id] ?? 0) * a.priceCentavos,
    0,
  );
  const total = variant.priceCentavos * quantity + addOnTotal;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addToCart({
        variantId: variant.id,
        quantity,
        addOns: Object.entries(addOns)
          .filter(([, q]) => q > 0)
          .map(([add_on_id, q]) => ({ add_on_id, quantity: q })),
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Added to your cart.", {
        action: { label: "View cart", onClick: () => router.push("/cart") },
      });
      router.refresh();
    });
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Price
          centavos={variant.priceCentavos}
          compareAtCentavos={variant.compareAtPriceCentavos ?? undefined}
          size="lg"
        />
        <AvailabilityBadge
          availability={variant.availability}
          quantity={variant.availableQuantity}
        />
      </div>

      {product.variants.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Size</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
            {product.variants.map((v) => {
              const selected = v.id === variantId;
              const unavailable = v.availability === "out_of_stock";
              return (
                <label
                  key={v.id}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-xl border px-4 py-2.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-foreground/30",
                    unavailable && "opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-variant`}
                    value={v.id}
                    checked={selected}
                    onChange={() => {
                      setVariantId(v.id);
                      setQuantity(1);
                    }}
                    className="sr-only"
                  />
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCentavos(v.priceCentavos)}
                    {unavailable ? " · Sold out" : ""}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {product.addOns.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Add-ons</legend>
          <ul className="flex flex-col gap-2">
            {product.addOns.map((addOn) => {
              const qty = addOns[addOn.id] ?? 0;
              const checked = qty > 0;
              return (
                <li
                  key={addOn.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                    checked ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                  )}
                >
                  <input
                    id={`${id}-addon-${addOn.id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setAddOns((s) => ({ ...s, [addOn.id]: e.target.checked ? 1 : 0 }))
                    }
                    className="size-4 accent-[var(--primary)]"
                  />
                  <label
                    htmlFor={`${id}-addon-${addOn.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <span className="font-medium">{addOn.name}</span>
                    {addOn.description ? (
                      <span className="block text-xs text-muted-foreground">
                        {addOn.description}
                      </span>
                    ) : null}
                  </label>
                  <span className="tabular-nums">
                    +{formatCentavos(addOn.priceCentavos)}
                  </span>
                  {checked && addOn.maxQuantity > 1 ? (
                    <select
                      aria-label={`${addOn.name} quantity`}
                      value={qty}
                      onChange={(e) =>
                        setAddOns((s) => ({ ...s, [addOn.id]: Number(e.target.value) }))
                      }
                      className="h-8 rounded-md border border-input bg-card px-1.5 text-sm"
                    >
                      {Array.from({ length: addOn.maxQuantity }, (_, i) => i + 1).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ),
                      )}
                    </select>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className="inline-flex h-11 items-center rounded-xl border border-input bg-card"
          role="group"
          aria-label="Quantity"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full w-11 rounded-l-xl"
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || soldOut}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <MinusIcon />
          </Button>
          <output
            aria-live="polite"
            className="w-10 text-center text-sm font-medium tabular-nums"
          >
            {quantity}
          </output>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full w-11 rounded-r-xl"
            aria-label="Increase quantity"
            disabled={quantity >= maxQty || soldOut}
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
          >
            <PlusIcon />
          </Button>
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-11 flex-1 text-base"
          disabled={soldOut || pending}
        >
          {pending ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <ShoppingBagIcon data-icon="inline-start" />
          )}
          {soldOut ? "Sold out" : `Add to cart · ${formatCentavos(total)}`}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
