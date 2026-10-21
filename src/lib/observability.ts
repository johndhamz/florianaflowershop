import "server-only";

/**
 * Minimal error reporting. Vercel captures stdout/stderr; an optional webhook
 * (`ALERT_WEBHOOK_URL`, e.g. a Slack/Discord/PagerDuty inbound URL) receives a
 * compact alert for unexpected server errors. Nothing here logs request bodies,
 * cookies or headers, so personal and payment data never reaches the log stream.
 */
export type ErrorReport = {
  message: string;
  name: string;
  digest?: string;
  path?: string;
  method?: string;
  routerKind?: string;
  routeType?: string;
  stack?: string;
};

const SECRET_LIKE =
  /(sk_(?:test|live)_[A-Za-z0-9]+|whsk_[A-Za-z0-9]+|re_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_-]{20,})/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Strips API keys, JWTs and email addresses from free text before it is logged or sent. */
export function redactSensitive(text: string): string {
  return text.replace(SECRET_LIKE, "[redacted]").replace(EMAIL, "[email]");
}

export function toErrorReport(
  error: unknown,
  request?: { path: string; method: string },
  context?: { routerKind: string; routeType: string },
): ErrorReport {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    name: err.name,
    message: redactSensitive(err.message).slice(0, 500),
    digest:
      typeof (err as { digest?: unknown }).digest === "string"
        ? String((err as { digest?: unknown }).digest)
        : undefined,
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routeType: context?.routeType,
    stack: err.stack
      ? redactSensitive(err.stack).split("\n").slice(0, 8).join("\n")
      : undefined,
  };
}

export async function reportError(report: ErrorReport): Promise<void> {
  console.error(JSON.stringify({ level: "error", source: "floriana", ...report }));
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 Floriana ${process.env.VERCEL_ENV ?? "local"}: ${report.name} on ${report.method ?? ""} ${report.path ?? ""} — ${report.message}${report.digest ? ` (digest ${report.digest})` : ""}`,
        report,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Alerting must never take the request down with it.
  }
}
