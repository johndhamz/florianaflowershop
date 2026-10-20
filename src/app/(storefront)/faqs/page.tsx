import type { Metadata } from "next";

import { Container } from "@/components/shared/container";
import { PageHeader } from "@/components/shared/page-header";
import { FaqList } from "@/components/storefront/faq-list";
import { JsonLd } from "@/components/storefront/json-ld";
import { faqsSchema, getContent } from "@/modules/content/queries";

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Answers about same-day delivery, gift messages, missed deliveries and orchid care.",
  alternates: { canonical: "/faqs" },
};

export default async function FaqsPage() {
  const faqs = await getContent("faqs", faqsSchema);
  const items = faqs?.items ?? [];

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10 sm:py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((i) => ({
            "@type": "Question",
            name: i.q,
            acceptedAnswer: { "@type": "Answer", text: i.a },
          })),
        }}
      />
      <PageHeader eyebrow="Help" title="Frequently asked questions" />
      {items.length ? (
        <FaqList items={items} />
      ) : (
        <p className="text-muted-foreground">
          FAQs are being written. Contact us with any question.
        </p>
      )}
    </Container>
  );
}
