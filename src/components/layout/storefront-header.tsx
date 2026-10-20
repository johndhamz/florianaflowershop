import { SearchIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { storefrontNav } from "@/config/site";

export function StorefrontHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="hidden border-b border-border/60 bg-sage-100/60 sm:block">
        <Container className="flex h-8 items-center justify-center text-xs tracking-wide text-sage-700">
          Same-day delivery across Cebu City for orders placed before 2 PM
        </Container>
      </div>
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2 md:hidden">
          <MobileNav />
        </div>

        <Logo className="md:mr-6" />

        <nav aria-label="Main" className="hidden md:flex md:flex-1">
          <ul className="flex items-center gap-1">
            {storefrontNav.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  matchNested
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  activeClassName="text-foreground bg-accent/70"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Search flowers" asChild>
            <Link href="/search">
              <SearchIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Cart, 0 items" asChild>
            <Link href="/cart">
              <ShoppingBagIcon />
            </Link>
          </Button>
          <Button className="ml-1 hidden sm:inline-flex" asChild>
            <Link href="/shop">Shop now</Link>
          </Button>
        </div>
      </Container>
    </header>
  );
}
