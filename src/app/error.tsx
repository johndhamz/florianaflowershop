"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error ? String(error.digest) : undefined;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <Logo size="lg" />
      <h1 className="mt-10 font-serif text-4xl font-semibold">Something went wrong</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        We could not load this page. Please try again in a moment.
        {digest ? (
          <>
            {" "}
            Reference: <code className="font-mono text-xs">{digest}</code>
          </>
        ) : null}
      </p>
      <div className="mt-8 flex gap-3">
        <Button size="lg" onClick={() => retry()}>
          Try again
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
