"use client";

import { AlertOctagonIcon } from "lucide-react";
import { useEffect } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function AdminError({
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
    <EmptyState
      icon={AlertOctagonIcon}
      title="Something went wrong"
      description={
        digest
          ? `We logged this with reference ${digest}. Try again or contact support.`
          : "We could not load this page. Try again."
      }
      action={<Button onClick={() => retry()}>Try again</Button>}
    />
  );
}
