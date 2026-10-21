"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatManila } from "@/lib/datetime";
import { saveCollectionSeo, saveContent, unpublishContent } from "@/modules/cms/actions";
import type { ContentKey } from "@/modules/cms/schemas";

type Block = {
  key: ContentKey;
  label: string;
  data: unknown;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  hasUnpublishedChanges: boolean;
};
type Collection = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  seo_title: string;
  seo_description: string;
  is_active: boolean;
  position: number;
};

export function ContentManager({
  blocks,
  collections,
}: {
  blocks: Block[];
  collections: Collection[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Block | null>(null);
  const [json, setJson] = useState("");
  const [col, setCol] = useState<Collection | null>(null);

  const act = (
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
    then?: () => void,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Saved");
      then?.();
      router.refresh();
    });

  const open = (b: Block) => {
    setEditing(b);
    setJson(JSON.stringify(b.data ?? {}, null, 2));
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="blocks-h" className="flex flex-col gap-3">
        <h2 id="blocks-h" className="font-sans text-base font-semibold">
          Content blocks
        </h2>
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {blocks.map((b) => (
            <li
              key={b.key}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {b.label}{" "}
                  <span className="font-mono text-xs text-muted-foreground">{b.key}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.publishedAt
                    ? `Published ${formatManila(b.publishedAt)}`
                    : "Never published"}
                  {b.updatedAt ? ` · edited ${formatManila(b.updatedAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {b.isPublished ? (
                  <StatusBadge tone="success">Published</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral" dot={false}>
                    Unpublished
                  </StatusBadge>
                )}
                {b.hasUnpublishedChanges ? (
                  <StatusBadge tone="warning" dot={false}>
                    Draft changes
                  </StatusBadge>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => open(b)}
                  aria-label={`Edit ${b.label}`}
                >
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cols-h" className="flex flex-col gap-3">
        <h2 id="cols-h" className="font-sans text-base font-semibold">
          Featured collections &amp; SEO
        </h2>
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {collections.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {c.position}. {c.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.seo_title || "No SEO title"} ·{" "}
                  {c.seo_description
                    ? `${c.seo_description.slice(0, 60)}…`
                    : "No SEO description"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.is_active ? (
                  <StatusBadge tone="success">Shown</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral" dot={false}>
                    Hidden
                  </StatusBadge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCol(c)}
                  aria-label={`Edit ${c.name}`}
                >
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
            <DialogDescription>
              Edit the JSON for this block. Drafts are validated on save; only published
              content reaches the storefront.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="content-json" className="sr-only">
            Content JSON
          </Label>
          <Textarea
            id="content-json"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={16}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <DialogFooter className="flex-wrap">
            {editing?.isPublished ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  editing &&
                  act(
                    () => unpublishContent(editing.key),
                    () => setEditing(null),
                  )
                }
              >
                Unpublish
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                editing &&
                act(
                  () => saveContent(editing.key, json, false),
                  () => setEditing(null),
                )
              }
            >
              Save draft
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                editing &&
                act(
                  () => saveContent(editing.key, json, true),
                  () => setEditing(null),
                )
              }
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!col} onOpenChange={(o) => !o && setCol(null)}>
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!col) return;
              const fd = new FormData(e.currentTarget);
              act(
                () =>
                  saveCollectionSeo({
                    id: col.id,
                    name: String(fd.get("name")),
                    tagline: String(fd.get("tagline") ?? ""),
                    description: String(fd.get("description") ?? ""),
                    seo_title: String(fd.get("seo_title") ?? ""),
                    seo_description: String(fd.get("seo_description") ?? ""),
                    is_active: fd.get("is_active") === "on",
                    position: Number(fd.get("position")),
                  }),
                () => setCol(null),
              );
            }}
            className="flex flex-col gap-3"
          >
            <DialogHeader>
              <DialogTitle>{col?.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" name="name" required defaultValue={col?.name} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-pos">Position</Label>
                <Input
                  id="c-pos"
                  name="position"
                  type="number"
                  defaultValue={col?.position}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="c-tag">Tagline</Label>
                <Input id="c-tag" name="tagline" defaultValue={col?.tagline} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="c-desc">Description</Label>
                <Textarea
                  id="c-desc"
                  name="description"
                  rows={3}
                  defaultValue={col?.description}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="c-seot">SEO title (≤ 70)</Label>
                <Input
                  id="c-seot"
                  name="seo_title"
                  maxLength={70}
                  defaultValue={col?.seo_title}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="c-seod">SEO description (≤ 160)</Label>
                <Textarea
                  id="c-seod"
                  name="seo_description"
                  maxLength={160}
                  rows={2}
                  defaultValue={col?.seo_description}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={col?.is_active} />{" "}
                Show on storefront
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCol(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
