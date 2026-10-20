"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { unitLabel } from "@/components/admin/inventory/qty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveRecipe } from "@/modules/inventory/actions";

type Material = { id: string; name: string; unit: string; category: string };
type Recipe = {
  name: string;
  instructions: string;
  assembly_minutes: number | null;
  items: { material_id: string; quantity: number; is_optional: boolean }[];
};

const schema = z.object({
  name: z.string().trim().min(2, "Give the recipe a name.").max(160),
  instructions: z.string().trim().max(2000).optional(),
  assembly_minutes: z
    .union([z.coerce.number().int().positive(), z.literal("").transform(() => null)])
    .optional(),
  items: z
    .array(
      z.object({
        material_id: z.uuid({ message: "Choose a material." }),
        quantity: z.coerce.number().positive("Quantity must be > 0."),
        is_optional: z.boolean(),
      }),
    )
    .min(1, "Add at least one material."),
});
type FormValues = z.input<typeof schema>;

export function RecipeEditor({
  variant,
  materials,
  recipe,
}: {
  variant: { id: string; sku: string; name: string };
  materials: Material[];
  recipe: Recipe | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: recipe
      ? { ...recipe, assembly_minutes: recipe.assembly_minutes ?? "" }
      : {
          name: variant.name,
          instructions: "",
          assembly_minutes: "",
          items: [{ material_id: "", quantity: 1, is_optional: false }],
        },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const submit = form.handleSubmit((values) => {
    const parsed = schema.parse(values);
    startTransition(async () => {
      const res = await saveRecipe({ variant_id: variant.id, ...parsed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.push("/admin/inventory/recipes");
      router.refresh();
    });
  });
  const grouped = Object.entries(
    materials.reduce<Record<string, Material[]>>(
      (acc, m) => ((acc[m.category] ??= []).push(m), acc),
      {},
    ),
  );

  return (
    <form
      onSubmit={submit}
      className="flex max-w-3xl flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6"
      aria-busy={pending}
    >
      <div>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {variant.sku}
        </p>
        <h2 className="font-sans text-lg font-semibold">{variant.name}</h2>
        <p className="text-sm text-muted-foreground">
          Bill of materials per unit sold. Required lines drive stock reservations and
          availability; optional lines are a guide for the florist.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rc-name">Recipe name</Label>
          <Input id="rc-name" {...form.register("name")} className="h-10 bg-background" />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rc-min">Assembly minutes</Label>
          <Input
            id="rc-min"
            type="number"
            min={1}
            {...form.register("assembly_minutes")}
            className="h-10 bg-background"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rc-instr">Instructions for the florist</Label>
        <Textarea
          id="rc-instr"
          rows={3}
          {...form.register("instructions")}
          className="bg-background"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Materials</legend>
        {fields.map((f, i) => {
          const mat = materials.find(
            (m) => m.id === form.watch(`items.${i}.material_id`),
          );
          return (
            <div
              key={f.id}
              className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2"
            >
              <select
                aria-label={`Material ${i + 1}`}
                {...form.register(`items.${i}.material_id`)}
                className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="">Choose…</option>
                {grouped.map(([cat, ms]) => (
                  <optgroup key={cat} label={cat}>
                    {ms.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="relative">
                <Input
                  aria-label={`Quantity ${i + 1}`}
                  type="number"
                  step="any"
                  min={0}
                  {...form.register(`items.${i}.quantity`)}
                  className="h-10 bg-background pr-12"
                />
                <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                  {mat ? unitLabel(mat.unit) : ""}
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" {...form.register(`items.${i}.is_optional`)} />
                Optional
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove line ${i + 1}`}
                onClick={() => remove(i)}
                disabled={fields.length === 1}
              >
                <Trash2Icon />
              </Button>
            </div>
          );
        })}
        {form.formState.errors.items?.root || form.formState.errors.items?.message ? (
          <p className="text-xs text-destructive">
            {String(
              form.formState.errors.items.root?.message ??
                form.formState.errors.items.message,
            )}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => append({ material_id: "", quantity: 1, is_optional: false })}
        >
          <PlusIcon data-icon="inline-start" />
          Add material
        </Button>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Save recipe
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/inventory/recipes")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
