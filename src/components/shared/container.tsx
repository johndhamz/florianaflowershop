import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Storefront page gutter. Phones get 16px; wider screens widen gracefully. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("container-shop", className)} {...props} />;
}
