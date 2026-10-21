"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProduct, updateVariant } from "@/modules/catalog/admin-actions";
import type { getAdminProduct } from "@/modules/catalog/admin-queries";

type Product = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

export function ProductEditor({ product }: { product: Product }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Saved");
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="font-sans text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() =>
                updateProduct({
                  id: product.id,
                  name: String(fd.get("name")),
                  short_description: String(fd.get("short_description") ?? ""),
                  description: String(fd.get("description") ?? ""),
                  care_instructions: String(fd.get("care_instructions") ?? ""),
                  status: String(fd.get("status")) as "active",
                  is_featured: fd.get("is_featured") === "on",
                  is_best_seller: fd.get("is_best_seller") === "on",
                  seo_title: String(fd.get("seo_title") ?? ""),
                  seo_description: String(fd.get("seo_description") ?? ""),
                  position: Number(fd.get("position")),
                }),
              );
            }}
          >
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" name="name" required defaultValue={product.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-status">Status</Label>
              <select
                id="p-status"
                name="status"
                defaultValue={product.status}
                className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
              >
                <option value="draft">Draft (hidden)</option>
                <option value="active">Active (on storefront)</option>
                <option value="archived">Archived (hidden)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-pos">Position</Label>
              <Input
                id="p-pos"
                name="position"
                type="number"
                min={0}
                defaultValue={product.position}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="p-short">Short description</Label>
              <Input
                id="p-short"
                name="short_description"
                maxLength={300}
                defaultValue={product.short_description ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                name="description"
                rows={4}
                defaultValue={product.description ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="p-care">Care instructions</Label>
              <Textarea
                id="p-care"
                name="care_instructions"
                rows={2}
                defaultValue={product.care_instructions ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-seot">SEO title</Label>
              <Input
                id="p-seot"
                name="seo_title"
                maxLength={70}
                defaultValue={product.seo_title ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-seod">SEO description</Label>
              <Input
                id="p-seod"
                name="seo_description"
                maxLength={160}
                defaultValue={product.seo_description ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={product.is_featured}
              />{" "}
              Featured on homepage
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_best_seller"
                defaultChecked={product.is_best_seller}
              />{" "}
              Best seller badge
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                Save product
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="font-sans text-base">Variants &amp; prices</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Price changes apply to new orders only. Existing orders keep the price they
            were placed at.
          </p>
          {product.product_variants
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((v) => (
              <form
                key={v.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"
                aria-label={`Variant ${v.name}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(() =>
                    updateVariant({
                      id: v.id,
                      productId: product.id,
                      name: String(fd.get("name")),
                      price_pesos: Number(fd.get("price")),
                      compare_at_pesos: fd.get("compare_at")
                        ? Number(fd.get("compare_at"))
                        : null,
                      is_active: fd.get("is_active") === "on",
                    }),
                  );
                }}
              >
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`v-name-${v.id}`}>
                    Name{" "}
                    <span className="text-muted-foreground">
                      · {v.sku}
                      {v.is_default ? " · default" : ""}
                    </span>
                  </Label>
                  <Input
                    id={`v-name-${v.id}`}
                    name="name"
                    required
                    defaultValue={v.name}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`v-price-${v.id}`}>Price (₱)</Label>
                  <Input
                    id={`v-price-${v.id}`}
                    name="price"
                    type="number"
                    step="0.01"
                    min={1}
                    required
                    defaultValue={(v.price_centavos / 100).toFixed(2)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`v-cmp-${v.id}`}>Compare-at (₱)</Label>
                  <Input
                    id={`v-cmp-${v.id}`}
                    name="compare_at"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={
                      v.compare_at_price_centavos
                        ? (v.compare_at_price_centavos / 100).toFixed(2)
                        : ""
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_active" defaultChecked={v.is_active} />{" "}
                  Available for sale
                </label>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="outline" disabled={pending}>
                    Save {v.name}
                  </Button>
                </div>
              </form>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
