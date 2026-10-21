import type { Instrumentation } from "next";

/** Called once per server start. Nothing to initialise yet; kept for future tracing setup. */
export async function register() {}

/** Called by Next.js for every unhandled server error (RSC, route handlers, server actions). */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // Expected authorization failures are handled by the UI; never page anyone for them.
  const name = error instanceof Error ? error.name : "";
  if (name === "ForbiddenError" || name === "UnauthorizedError") return;
  const { reportError, toErrorReport } = await import("@/lib/observability");
  await reportError(
    toErrorReport(error, { path: request.path, method: request.method }, context),
  );
};
