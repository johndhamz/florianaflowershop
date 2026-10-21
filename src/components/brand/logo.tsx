import Link from "next/link";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

type LogoProps = {
  href?: string;
  className?: string;
  /** Show the tagline under the wordmark. */
  withTagline?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

export function Logo({
  href = "/",
  className,
  withTagline = false,
  size = "md",
}: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group/logo inline-flex flex-col rounded-md leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span
        className={cn(
          "font-serif font-semibold tracking-tight text-cocoa",
          sizeClass[size],
        )}
      >
        Floriana
        <span className="ml-1 font-normal text-sage-600 italic">Flowers</span>
      </span>
      {withTagline ? (
        <span className="mt-1 text-xs tracking-wide text-muted-foreground">
          {siteConfig.tagline}
        </span>
      ) : null}
    </Link>
  );
}
