import { z } from "zod";

const cta = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(200),
});

/** Editable content blocks: key → schema + label. Storefront queries validate against the same schemas. */
export const CONTENT_BLOCKS = {
  "home.hero": {
    label: "Homepage hero",
    schema: z.object({
      eyebrow: z.string().trim().max(80).optional(),
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().min(1).max(600),
      cta_primary: cta,
      cta_secondary: cta.optional(),
      image_path: z.string().trim().max(200).optional(),
    }),
  },
  "home.story": {
    label: "Homepage story",
    schema: z.object({
      eyebrow: z.string().trim().max(80).optional(),
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().min(1).max(800),
      image_path: z.string().trim().max(200).optional(),
      cta: cta.optional(),
    }),
  },
  "about.story": {
    label: "Our story page",
    schema: z.object({
      title: z.string().trim().min(1).max(120),
      paragraphs: z.array(z.string().trim().min(1).max(1200)).min(1),
    }),
  },
  "delivery.info": {
    label: "Delivery information",
    schema: z.object({
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().min(1).max(1500),
    }),
  },
  faqs: {
    label: "FAQs",
    schema: z.object({
      items: z
        .array(
          z.object({
            q: z.string().trim().min(1).max(200),
            a: z.string().trim().min(1).max(1000),
          }),
        )
        .min(1),
    }),
  },
  contact: {
    label: "Contact information",
    schema: z.object({
      email: z.email(),
      phone: z.string().trim().min(5).max(40),
      hours: z.string().trim().min(1).max(120),
      address: z.string().trim().min(1).max(200),
    }),
  },
  seo: {
    label: "SEO defaults",
    schema: z.object({
      site_title: z.string().trim().min(1).max(70),
      site_description: z.string().trim().min(1).max(160),
      shop_title: z.string().trim().max(70).optional(),
      shop_description: z.string().trim().max(160).optional(),
    }),
  },
} as const;

export type ContentKey = keyof typeof CONTENT_BLOCKS;
export const CONTENT_KEYS = Object.keys(CONTENT_BLOCKS) as ContentKey[];
