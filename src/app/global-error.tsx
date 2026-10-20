"use client";

import "./globals.css";

/**
 * Last-resort boundary: replaces the root layout, so it must render <html>/<body>
 * and cannot rely on fonts or providers.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    error instanceof Error && "digest" in error ? String(error.digest) : undefined;

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-[#F7F0E7] px-4 text-center text-[#3F2B23]">
        <title>Something went wrong · Floriana Flowers</title>
        <p className="text-2xl font-semibold">Floriana Flowers</p>
        <h1 className="mt-8 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 max-w-md text-[#7A6256]">
          The application hit an unexpected error.
          {digest ? ` Reference: ${digest}.` : ""}
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-8 rounded-lg bg-[#614438] px-5 py-2.5 text-sm font-medium text-[#F7F0E7]"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
