import type { Metadata } from "next";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { getBusinessSettings } from "@/modules/content/queries";

export const metadata: Metadata = {
  title: "Privacy notice",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const settings = await getBusinessSettings();
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-10 sm:py-14">
      <PageHeader
        eyebrow="Legal"
        title="Privacy notice"
        description="How we handle your personal data under the Philippine Data Privacy Act of 2012 (RA 10173)."
      />
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground/90">
        <p>
          We collect only what we need to deliver flowers: your name, email, mobile
          number, and the recipient&apos;s name, number and address. We use these to
          process and deliver your order, send order updates, and respond to your
          messages.
        </p>
        <p>
          Recipient details are shared only with the florist preparing the order and the
          rider delivering it. Payment card details are never stored on our systems; they
          are handled by our payment provider.
        </p>
        <p>
          We keep order records for accounting and warranty purposes as required by law,
          then delete or anonymise them. You may ask us to access, correct or delete your
          personal data by emailing{" "}
          <a
            href={`mailto:${settings.contact_email}`}
            className="underline underline-offset-4"
          >
            {settings.contact_email}
          </a>
          .
        </p>
        <p className="text-muted-foreground">
          This notice is a draft prepared for review by the shop owner before launch.
        </p>
      </div>
    </Container>
  );
}
