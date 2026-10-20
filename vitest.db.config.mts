import { defineConfig } from "vitest/config";

/** Integration tests against the local Supabase Postgres. Run with `npm run test:db`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/db/**/*.db.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
