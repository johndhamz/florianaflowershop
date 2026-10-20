import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RecipeEditor } from "@/components/admin/inventory/recipe-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/modules/auth/dal";
import { getRecipeForVariant, listMaterials } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Recipe editor" };

async function Editor({
  params,
}: {
  params: PageProps<"/admin/inventory/recipes/[variantId]">["params"];
}) {
  await requireStaff("inventory.manage");
  const { variantId } = await params;
  const [variant, materials] = await Promise.all([
    getRecipeForVariant(variantId),
    listMaterials(),
  ]);
  if (!variant) notFound();
  return (
    <RecipeEditor
      variant={{
        id: variant.id,
        sku: variant.sku,
        name: `${variant.products?.name ?? ""} · ${variant.name}`,
      }}
      materials={materials
        .filter((m) => m.is_active)
        .map((m) => ({ id: m.id, name: m.name, unit: m.unit, category: m.category }))}
      recipe={
        variant.bouquet_recipes
          ? {
              name: variant.bouquet_recipes.name,
              instructions: variant.bouquet_recipes.instructions ?? "",
              assembly_minutes: variant.bouquet_recipes.assembly_minutes,
              items: variant.bouquet_recipes.recipe_items.map((i) => ({
                material_id: i.material_id,
                quantity: Number(i.quantity),
                is_optional: i.is_optional,
              })),
            }
          : null
      }
    />
  );
}

export default function RecipeEditorPage(
  props: PageProps<"/admin/inventory/recipes/[variantId]">,
) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl rounded-2xl" />}>
      <Editor params={props.params} />
    </Suspense>
  );
}
