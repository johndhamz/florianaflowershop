"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { settleMockPayment } from "@/modules/payments/mock-actions";

export function MockPayButtons({
  sessionId,
  successUrl,
  cancelUrl,
}: {
  sessionId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const settle = (outcome: "paid" | "failed", redirect: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await settleMockPayment(sessionId, outcome);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (redirect) window.location.assign(outcome === "paid" ? successUrl : cancelUrl);
    });

  return (
    <div className="mt-6 flex flex-col gap-2">
      <Button onClick={() => settle("paid", true)} disabled={pending} size="lg">
        Authorize
      </Button>
      <Button
        onClick={() => settle("failed", true)}
        disabled={pending}
        size="lg"
        variant="outline"
      >
        Fail
      </Button>
      <Button
        onClick={() => settle("paid", false)}
        disabled={pending}
        variant="ghost"
        size="sm"
        data-testid="authorize-no-redirect"
      >
        Authorize, then close the browser (webhook only)
      </Button>
      <Button asChild variant="link" size="sm">
        <a href={cancelUrl}>Cancel and go back</a>
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
