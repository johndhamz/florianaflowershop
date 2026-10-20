import { ShoppingBagIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCartCount } from "@/modules/cart/queries";

export function CartLink({ count }: { count: number }) {
  const label = count === 1 ? "Cart, 1 item" : `Cart, ${count} items`;
  return (
    <Button variant="ghost" size="icon" aria-label={label} className="relative" asChild>
      <Link href="/cart">
        <ShoppingBagIcon />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
            data-testid="cart-count"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

/** Request-time: reads the cart cookie. Render inside <Suspense>. */
export async function CartBadge() {
  const count = await getCartCount();
  return <CartLink count={count} />;
}
