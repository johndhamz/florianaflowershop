import type { ReactNode } from "react";

import { SkipLink } from "@/components/layout/skip-link";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { StorefrontHeader } from "@/components/layout/storefront-header";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <StorefrontHeader />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <StorefrontFooter />
    </div>
  );
}
