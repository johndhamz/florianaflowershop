"use client";

import { PackagePlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { unitLabel } from "@/components/admin/inventory/qty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { receiveStock } from "@/modules/inventory/actions";

type Material = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  is_perishable: boolean;
  shelf_life_days: number | null;
  default_supplier_id: string | null;
};

const schema = z.object({
  material_id: z.uuid({ message: "Choose a material." }),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unit_cost_pesos: z.coerce.number().min(0, "Cost cannot be negative."),
  batch_code: z.string().trim().max(60).optional(),
  supplier_id: z.union([z.uuid(), z.literal("")]).optional(),
  received_at: z.string().optional(),
  expires_at: z.string().optional(),
  notes: z.string().trim().max(300).optional(),
});
type FormValues = z.input<typeof schema>;

function manilaDateInput(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
}

export function ReceiveForm({
  materials,
  suppliers,
}: {
  materials: Material[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      material_id: "",
      quantity: "" as unknown as number,
      unit_cost_pesos: "" as unknown as number,
      received_at: manilaDateInput(),
      expires_at: "",
      supplier_id: "",
      batch_code: "",
      notes: "",
    },
  });
  const materialId = form.watch("material_id");
  const material = materials.find((m) => m.id === materialId);

  const onMaterialChange = (id: string) => {
    const m = materials.find((x) => x.id === id);
    if (m?.default_supplier_id) form.setValue("supplier_id", m.default_supplier_id);
    if (m?.is_perishable && m.shelf_life_days)
      form.setValue("expires_at", manilaDateInput(m.shelf_life_days));
    else form.setValue("expires_at", "");
  };

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await receiveStock(values);
      if (!res.ok) {
        toast.error(res.error);
        for (const [k, v] of Object.entries(res.fieldErrors ?? {}))
          form.setError(k as keyof FormValues, { message: v });
        return;
      }
      toast.success(res.message);
      form.reset({
        material_id: "",
        quantity: "" as unknown as number,
        unit_cost_pesos: "" as unknown as number,
        received_at: manilaDateInput(),
        expires_at: "",
        supplier_id: "",
        batch_code: "",
        notes: "",
      });
      router.refresh();
    });
  });
  const err = (k: keyof FormValues) =>
    form.formState.errors[k]?.message ? (
      <p className="text-xs text-destructive">
        {String(form.formState.errors[k]?.message)}
      </p>
    ) : null;

  return (
    <form
      onSubmit={submit}
      className="flex max-w-2xl flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6"
      aria-busy={pending}
      data-hydrated={hydrated ? "true" : undefined}
    >
      <div>
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
          <PackagePlusIcon aria-hidden className="size-4 text-sage-600" />
          Receive inventory
        </h2>
        <p className="text-sm text-muted-foreground">
          Creates a dated, costed batch. Perishables get an expiry from the
          material&apos;s shelf life; adjust if the supplier says otherwise.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="r-material">Material</Label>
          <select
            id="r-material"
            {...form.register("material_id", {
              onChange: (e) => onMaterialChange(e.target.value),
            })}
            className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Choose a material…</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.sku})
              </option>
            ))}
          </select>
          {err("material_id")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-qty">
            Quantity{material ? ` (${unitLabel(material.unit)})` : ""}
          </Label>
          <Input
            id="r-qty"
            type="number"
            step="any"
            min={0}
            {...form.register("quantity")}
            className="h-10 bg-background"
          />
          {err("quantity")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-cost">Unit cost (₱)</Label>
          <Input
            id="r-cost"
            type="number"
            step="0.01"
            min={0}
            {...form.register("unit_cost_pesos")}
            className="h-10 bg-background"
          />
          {err("unit_cost_pesos")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-received">Received on</Label>
          <Input
            id="r-received"
            type="date"
            {...form.register("received_at")}
            className="h-10 bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-expires">
            Expires on {material && !material.is_perishable ? "(non-perishable)" : ""}
          </Label>
          <Input
            id="r-expires"
            type="date"
            {...form.register("expires_at")}
            className="h-10 bg-background"
            disabled={!!material && !material.is_perishable}
          />
          {err("expires_at")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-supplier">Supplier</Label>
          <select
            id="r-supplier"
            {...form.register("supplier_id")}
            className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-code">Batch code (optional)</Label>
          <Input
            id="r-code"
            {...form.register("batch_code")}
            placeholder="Auto-generated if blank"
            className="h-10 bg-background"
          />
          {err("batch_code")}
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="r-notes">Notes</Label>
          <Input
            id="r-notes"
            {...form.register("notes")}
            className="h-10 bg-background"
          />
        </div>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        Receive into stock
      </Button>
    </form>
  );
}
