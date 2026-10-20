import type { Metadata } from "next";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";

import { FacebookGlyph, InstagramGlyph } from "@/components/brand/social-icons";
import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import {
  contactSchema,
  getBusinessSettings,
  getContent,
} from "@/modules/content/queries";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach Floriana Flowers by email, phone or social media. Shop hours and location in Cebu City.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const [contact, settings] = await Promise.all([
    getContent("contact", contactSchema),
    getBusinessSettings(),
  ]);
  const email = contact?.email ?? settings.contact_email;
  const phone = contact?.phone ?? settings.contact_phone;

  const rows = [
    { icon: MailIcon, label: "Email", value: email, href: `mailto:${email}` },
    {
      icon: PhoneIcon,
      label: "Phone / Viber",
      value: phone,
      href: `tel:${phone.replace(/\s+/g, "")}`,
    },
    {
      icon: ClockIcon,
      label: "Hours",
      value: contact?.hours ?? "Monday to Saturday, 8 AM – 6 PM",
    },
    {
      icon: MapPinIcon,
      label: "Studio",
      value: contact?.address ?? settings.address ?? "Cebu City",
    },
  ] as const;

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Contact"
        title="Talk to us"
        description="Questions about an order, a custom request for an event, or just want to say hello?"
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, value, ...rest }) => (
          <li
            key={label}
            className="flex gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon aria-hidden className="size-5" />
            </span>
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              {"href" in rest ? (
                <a
                  href={rest.href}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {value}
                </a>
              ) : (
                <p className="font-medium">{value}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Follow along</span>
        {settings.social.instagram ? (
          <a
            href={settings.social.instagram}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="inline-flex size-9 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10 hover:bg-accent"
          >
            <InstagramGlyph className="size-4" />
          </a>
        ) : null}
        {settings.social.facebook ? (
          <a
            href={settings.social.facebook}
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
            className="inline-flex size-9 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10 hover:bg-accent"
          >
            <FacebookGlyph className="size-4" />
          </a>
        ) : null}
      </div>
    </Container>
  );
}
