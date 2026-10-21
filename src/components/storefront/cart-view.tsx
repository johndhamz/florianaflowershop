"use client";

import {
  AlertTriangleIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { formatCentavos } from "@/lib/money";
import { productImageSrc } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import {
  removeCartItem,
  removeUnavailableItems,
  updateCartItem,
} from "@/modules/cart/actions";
import type { Cart, CartLine } from "@/modules/cart/types";
import { AVAILABILITY_LABELS } from "@/modules/catalog/types";

export function CartView({ cart: initial }: { cart: Cart }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cart, setOptimistic] = useOptimistic(initial);

  const apply = (
    fn: () => Promise<
      { ok: true; cart: Cart; message?: string } | { ok: false; error: string }
    >,
    optimistic?: Cart,
  ) => {
    startTransition(async () => {
      if (optimistic) setOptimistic(optimistic);
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
      } else if (result.message) {
        toast.success(result.message);
      }
      router.refresh();
    });
  };

  const changeQuantity = (line: CartLine, quantity: number) => {
    const items = cart.items.map((l) =>
      l.id === line.id
        ? { ...l, quantity, line_total_centavos: l.unit_price_centavos * quantity }
        : l,
    );
    apply(
      () => updateCartItem({ itemId: line.id, quantity }),
      recompute({ ...cart, items }),
    );
  };

  const remove = (line: CartLine) => {
    apply(
      () => removeCartItem(line.id),
      recompute({ ...cart, items: cart.items.filter((l) => l.id !== line.id) }),
    );
  };

  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBagIcon}
        title="Your cart is empty"
        description="Browse the shop and add a bouquet, an orchid, or a little everyday bunch."
        action={
          <Button size="lg" asChild>
            <Link href="/shop">Shop flowers</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div
      className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start"
      aria-busy={pending}
    >
      <section aria-labelledby="cart-items-heading" className="flex flex-col gap-4">
        <h2 id="cart-items-heading" className="sr-only">
          Items in your cart
        </h2>

        {cart.has_issues ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="flex items-start gap-2">
              <AlertTriangleIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-warning"
              />
              <span>
                Some items changed since you added them. Review the notes below before
                checking out.
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => apply(removeUnavailableItems)}
              className="shrink-0 bg-card"
            >
              Update cart
            </Button>
          </div>
        ) : null}

        <ul className="divide-y rounded-2xl bg-card ring-1 ring-foreground/10">
          {cart.items.map((line) => (
            <li
              key={line.id}
              className={cn("flex gap-4 p-4", !line.is_available && "bg-muted/40")}
            >
              <Link
                href={`/shop/${line.product_slug}`}
                className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/5 sm:size-28"
              >
                <Image
                  src={productImageSrc(line.image_path)}
                  alt={line.image_alt ?? line.product_name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-serif text-lg leading-tight font-semibold">
                      <Link
                        href={`/shop/${line.product_slug}`}
                        className="hover:underline"
                      >
                        {line.product_name}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">{line.variant_name}</p>
                    {line.add_ons.length > 0 ? (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {line.add_ons.map((a) => (
                          <li key={a.add_on_id}>
                            + {a.name}
                            {a.quantity > 1 ? ` × ${a.quantity}` : ""} ·{" "}
                            {formatCentavos(a.line_total_centavos)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-right text-sm font-medium tabular-nums">
                    {formatCentavos(
                      line.line_total_centavos + line.add_ons_total_centavos,
                    )}
                  </p>
                </div>

                {!line.is_available ? (
                  <p className="text-xs font-medium text-destructive">
                    {line.availability === "out_of_stock"
                      ? AVAILABILITY_LABELS.out_of_stock
                      : line.available_quantity !== null &&
                          line.available_quantity < line.quantity
                        ? `Only ${line.available_quantity} available`
                        : "No longer available"}
                  </p>
                ) : line.price_changed ? (
                  <p className="text-xs text-warning">
                    Price updated from {formatCentavos(line.unit_price_at_add_centavos)}{" "}
                    to {formatCentavos(line.unit_price_centavos)}.
                  </p>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-3">
                  <div
                    className="inline-flex h-9 items-center rounded-lg border border-input bg-background"
                    role="group"
                    aria-label={`${line.product_name} quantity`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-full w-9"
                      aria-label="Decrease quantity"
                      disabled={line.quantity <= 1 || pending}
                      onClick={() => changeQuantity(line, line.quantity - 1)}
                    >
                      <MinusIcon />
                    </Button>
                    <output
                      className="w-8 text-center text-sm tabular-nums"
                      aria-live="polite"
                    >
                      {line.quantity}
                    </output>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-full w-9"
                      aria-label="Increase quantity"
                      disabled={
                        pending ||
                        line.quantity >= 50 ||
                        (line.available_quantity !== null &&
                          line.quantity >= line.available_quantity)
                      }
                      onClick={() => changeQuantity(line, line.quantity + 1)}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => remove(line)}
                    disabled={pending}
                    aria-label={`Remove ${line.product_name}`}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="cart-summary-heading"
        className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-24"
      >
        <h2 id="cart-summary-heading" className="font-serif text-xl font-semibold">
          Order summary
        </h2>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Items ({cart.item_count})</dt>
            <dd className="tabular-nums">{formatCentavos(cart.subtotal_centavos)}</dd>
          </div>
          {cart.add_ons_centavos > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Add-ons</dt>
              <dd className="tabular-nums">{formatCentavos(cart.add_ons_centavos)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-muted-foreground">Calculated at checkout</dd>
          </div>
          <div className="mt-2 flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="cart-total">
              {formatCentavos(cart.total_centavos)}
            </dd>
          </div>
        </dl>
        <Button
          size="lg"
          className="mt-5 h-11 w-full text-base"
          disabled={cart.has_issues || pending}
          asChild={!cart.has_issues && !pending}
        >
          {cart.has_issues || pending ? (
            <span>
              {pending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : null}
              Proceed to checkout
            </span>
          ) : (
            <Link href="/checkout">Proceed to checkout</Link>
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Guest checkout · Prices in Philippine Peso · Stock is confirmed at checkout
        </p>
        <Button variant="link" className="mt-1 w-full" asChild>
          <Link href="/shop">Continue shopping</Link>
        </Button>
      </aside>
    </div>
  );
}

/** Client-side mirror of the server totals for optimistic updates only. */
function recompute(cart: Cart): Cart {
  const available = cart.items.filter((l) => l.is_available);
  const subtotal = available.reduce((s, l) => s + l.line_total_centavos, 0);
  const addOns = available.reduce((s, l) => s + l.add_ons_total_centavos, 0);
  return {
    ...cart,
    item_count: available.reduce((s, l) => s + l.quantity, 0),
    subtotal_centavos: subtotal,
    add_ons_centavos: addOns,
    total_centavos: subtotal + addOns,
    has_issues: cart.items.some((l) => !l.is_available || l.price_changed),
  };
}
