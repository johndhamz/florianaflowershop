import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { siteConfig } from "@/config/site";
import { getContent, seoSchema } from "@/modules/content/queries";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

/** Site-wide SEO defaults come from the published `seo` content block, falling back to static config. */
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getContent("seo", seoSchema).catch(() => null);
  const title = seo?.site_title ?? `${siteConfig.name} · ${siteConfig.tagline}`;
  const description = seo?.site_description ?? siteConfig.description;
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: title, template: `%s · ${siteConfig.name}` },
    description,
    applicationName: siteConfig.name,
    openGraph: {
      type: "website",
      locale: "en_PH",
      siteName: siteConfig.name,
      title,
      description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#F7F0E7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
