import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <Logo size="lg" />
      <p className="mt-10 text-xs font-medium tracking-[0.18em] text-sage-600 uppercase">
        404
      </p>
      <h1 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
        This bloom has wandered off
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The page you are looking for does not exist or has been moved. Let us bring you
        back to the shop.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/shop">Browse flowers</Link>
        </Button>
      </div>
    </div>
  );
}
