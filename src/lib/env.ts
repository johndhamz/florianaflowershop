import { z } from "zod";

/**
 * Environment validation.
 *
 * - `publicEnv`  → NEXT_PUBLIC_* values, inlined at build time, safe in the browser.
 * - `getServerEnv()` → server-only values, validated lazily so importing this module
 *   never leaks secrets to the client bundle and never crashes pages that don't need them.
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when referenced literally, so each
 * key is spelled out explicitly below (no dynamic lookups).
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, { message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" }),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Server-only. Used by trusted paths: checkout, webhooks, jobs, media seeding.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Payments. "mock" is for local dev/E2E only and refuses to run in production.
  PAYMENT_PROVIDER: z.enum(["paymongo", "mock"]).default("mock"),
  PAYMONGO_SECRET_KEY: z.string().startsWith("sk_").optional(),
  PAYMONGO_PUBLIC_KEY: z.string().startsWith("pk_").optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().min(8).optional(),
  ALLOW_MOCK_PAYMENTS: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Shared secret for scheduled job endpoints (/api/jobs/*).
  CRON_SECRET: z.string().min(16).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema> & PublicEnv;

export class EnvValidationError extends Error {
  constructor(scope: "public" | "server", issues: z.core.$ZodIssue[]) {
    const lines = issues.map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`);
    super(
      `Invalid ${scope} environment variables:\n${lines.join("\n")}\n` +
        `See .env.example and copy it to .env.local.`,
    );
    this.name = "EnvValidationError";
  }
}

function readPublicRaw() {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function parsePublicEnv(
  raw: Record<string, string | undefined> = readPublicRaw(),
) {
  const parsed = publicSchema.safeParse(raw);
  if (!parsed.success) throw new EnvValidationError("public", parsed.error.issues);
  return parsed.data;
}

export function parseServerEnv(raw: Record<string, string | undefined> = process.env) {
  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) throw new EnvValidationError("server", parsed.error.issues);
  return { ...parsePublicEnv(), ...parsed.data };
}

let publicCache: PublicEnv | undefined;
let serverCache: ServerEnv | undefined;

/** Validated NEXT_PUBLIC_* variables (memoised). */
export function getPublicEnv(): PublicEnv {
  publicCache ??= parsePublicEnv();
  return publicCache;
}

/** Validated server variables (memoised). Must only be called from server code. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in the browser.");
  }
  serverCache ??= parseServerEnv();
  return serverCache;
}
