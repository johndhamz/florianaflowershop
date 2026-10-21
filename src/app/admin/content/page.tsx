import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentManager } from "@/components/admin/content/content-manager";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";
import { CONTENT_BLOCKS, CONTENT_KEYS } from "@/modules/cms/schemas";

export const metadata: Metadata = { title: "Content" };

async function Content() {
  await requireStaff("content.manage");
  const supabase = await createClient();
  const [{ data: rows }, { data: collections }] = await Promise.all([
    supabase
      .from("site_content")
      .select("key, data, is_published, published_data, published_at, updated_at")
      .in("key", CONTENT_KEYS),
    supabase
      .from("collections")
      .select(
        "id, slug, name, tagline, description, seo_title, seo_description, is_active, position",
      )
      .order("position"),
  ]);
  const byKey = new Map((rows ?? []).map((r) => [r.key, r]));
  return (
    <ContentManager
      blocks={CONTENT_KEYS.map((key) => ({
        key,
        label: CONTENT_BLOCKS[key].label,
        data: byKey.get(key)?.data ?? null,
        isPublished: byKey.get(key)?.is_published ?? false,
        publishedAt: byKey.get(key)?.published_at ?? null,
        updatedAt: byKey.get(key)?.updated_at ?? null,
        hasUnpublishedChanges:
          !!byKey.get(key) &&
          JSON.stringify(byKey.get(key)!.data) !==
            JSON.stringify(byKey.get(key)!.published_data),
      }))}
      collections={(collections ?? []).map((c) => ({
        ...c,
        tagline: c.tagline ?? "",
        description: c.description ?? "",
        seo_title: c.seo_title ?? "",
        seo_description: c.seo_description ?? "",
      }))}
    />
  );
}

export default function ContentPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Content"
        description="Homepage hero and story, featured collections, Our Story, delivery information, FAQs, contact details and SEO. Save drafts, then publish."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
        <Content />
      </Suspense>
    </div>
  );
}
