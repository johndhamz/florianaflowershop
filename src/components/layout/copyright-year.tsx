import { cacheLife } from "next/cache";

/**
 * The current year is "unstable" during prerendering with Cache Components,
 * so it is computed inside a cached scope that refreshes daily.
 */
export async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}
