import { MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { CopyrightYear } from "@/components/layout/copyright-year";
import { FacebookGlyph, InstagramGlyph } from "@/components/brand/social-icons";
import { Container } from "@/components/shared/container";
import { footerNav, siteConfig } from "@/config/site";

const groups = [
  { heading: "Shop", items: footerNav.shop },
  { heading: "Help", items: footerNav.help },
  { heading: "Company", items: footerNav.company },
] as const;

export function StorefrontFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-ivory-100">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8 lg:py-16">
        <div className="max-w-xs">
          <Logo withTagline />
          <p className="mt-4 text-sm text-muted-foreground">
            Named after Lola Floriana, 86, who still tends her orchids every morning. We
            bring that same care to every stem we deliver across Cebu.
          </p>
          <ul className="mt-5 flex flex-col gap-2 text-sm">
            <li>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="inline-flex items-center gap-2 text-foreground/80 hover:text-foreground"
              >
                <MailIcon aria-hidden className="size-4 text-sage-600" />
                {siteConfig.contact.email}
              </a>
            </li>
            <li>
              <a
                href={`tel:${siteConfig.contact.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 text-foreground/80 hover:text-foreground"
              >
                <PhoneIcon aria-hidden className="size-4 text-sage-600" />
                {siteConfig.contact.phone}
              </a>
            </li>
          </ul>
        </div>

        {groups.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-sage-700 uppercase">
              {group.heading}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t border-border/70">
        <Container className="flex flex-col gap-3 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CopyrightYear /> {siteConfig.name} · {siteConfig.location}. Prices in
            Philippine Peso (₱).
          </p>
          <ul className="flex items-center gap-3" aria-label="Social media">
            <li>
              <a
                href={siteConfig.contact.instagram}
                className="inline-flex size-8 items-center justify-center rounded-full hover:bg-accent"
                aria-label="Instagram"
                rel="noreferrer"
                target="_blank"
              >
                <InstagramGlyph className="size-4" />
              </a>
            </li>
            <li>
              <a
                href={siteConfig.contact.facebook}
                className="inline-flex size-8 items-center justify-center rounded-full hover:bg-accent"
                aria-label="Facebook"
                rel="noreferrer"
                target="_blank"
              >
                <FacebookGlyph className="size-4" />
              </a>
            </li>
          </ul>
        </Container>
      </div>
    </footer>
  );
}
