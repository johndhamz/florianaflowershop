"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Qty } from "@/components/admin/inventory/qty";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
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
import { saveMaterial } from "@/modules/inventory/actions";

export type MaterialRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  is_perishable: boolean;
  default_shelf_life_days: number | null;
  low_stock_threshold: number;
  default_supplier_id: string | null;
  supplier_name: string | null;
  is_active: boolean;
  available: number;
  on_hand: number;
  is_low: boolean;
};

const schema = z.object({
  sku: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Uppercase letters, digits and dashes."),
  name: z.string().trim().min(2, "Name is required.").max(160),
  category: z.enum([
    "flower",
    "foliage",
    "plant",
    "container",
    "wrap",
    "accessory",
    "consumable",
  ]),
  unit: z.enum(["stem", "bunch", "piece", "gram", "millilitre", "metre"]),
  is_perishable: z.boolean(),
  default_shelf_life_days: z.union([
    z.coerce.number().int().positive(),
    z.literal("").transform(() => null),
    z.null(),
  ]),
  low_stock_threshold: z.coerce.number().min(0, "Cannot be negative."),
  default_supplier_id: z.union([z.uuid(), z.literal("").transform(() => null), z.null()]),
  is_active: z.boolean(),
});
type FormValues = z.input<typeof schema>;

const select = "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm";

export function MaterialsManager({
  materials,
  suppliers,
  canEdit,
}: {
  materials: MaterialRow[];
  suppliers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MaterialRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const open = (row: MaterialRow | "new") => {
    setEditing(row);
    form.reset(
      row === "new"
        ? {
            sku: "",
            name: "",
            category: "flower",
            unit: "stem",
            is_perishable: true,
            default_shelf_life_days: 7,
            low_stock_threshold: 0,
            default_supplier_id: "",
            is_active: true,
          }
        : {
            sku: row.sku,
            name: row.name,
            category: row.category as FormValues["category"],
            unit: row.unit as FormValues["unit"],
            is_perishable: row.is_perishable,
            default_shelf_life_days: row.default_shelf_life_days ?? "",
            low_stock_threshold: row.low_stock_threshold,
            default_supplier_id: row.default_supplier_id ?? "",
            is_active: row.is_active,
          },
    );
  };

  const submit = form.handleSubmit((values) => {
    const parsed = schema.parse(values);
    startTransition(async () => {
      const res = await saveMaterial({
        ...parsed,
        id: editing && editing !== "new" ? editing.id : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        for (const [k, v] of Object.entries(res.fieldErrors ?? {}))
          form.setError(k as keyof FormValues, { message: v });
        return;
      }
      toast.success(res.message);
      setEditing(null);
      router.refresh();
    });
  });

  const columns: DataTableColumn<MaterialRow>[] = [
    {
      id: "name",
      header: "Material",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">
            {r.sku} · {r.category}
          </p>
        </div>
      ),
    },
    {
      id: "available",
      header: "Available",
      align: "right",
      cell: (r) => <Qty value={r.available} unit={r.unit} />,
    },
    {
      id: "threshold",
      header: "Low at",
      align: "right",
      hideBelow: "sm",
      cell: (r) => <Qty value={r.low_stock_threshold} unit={r.unit} />,
    },
    {
      id: "shelf",
      header: "Shelf life",
      hideBelow: "md",
      cell: (r) =>
        r.is_perishable ? `${r.default_shelf_life_days ?? "—"} days` : "Non-perishable",
    },
    {
      id: "supplier",
      header: "Supplier",
      hideBelow: "lg",
      cell: (r) => r.supplier_name ?? "—",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        !r.is_active ? (
          <StatusBadge tone="neutral" dot={false}>
            Inactive
          </StatusBadge>
        ) : r.is_low ? (
          <StatusBadge tone="warning">Low</StatusBadge>
        ) : (
          <StatusBadge tone="success">OK</StatusBadge>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => open(r)}
            aria-label={`Edit ${r.name}`}
          >
            Edit
          </Button>
        ) : null,
    },
  ];

  const err = (k: keyof FormValues) =>
    form.formState.errors[k]?.message ? (
      <p className="text-xs text-destructive">
        {String(form.formState.errors[k]?.message)}
      </p>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{materials.length} materials</p>
        {canEdit ? (
          <Button onClick={() => open("new")}>
            <PlusIcon data-icon="inline-start" />
            New material
          </Button>
        ) : null}
      </div>
      <DataTable
        columns={columns}
        rows={materials}
        getRowId={(r) => r.id}
        caption="Materials"
      />

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {editing === "new" ? "New material" : `Edit ${editing?.name ?? ""}`}
              </DialogTitle>
              <DialogDescription>
                Stems, foliage, containers, wraps, ribbons and accessories all live here.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-sku">SKU</Label>
                <Input id="m-sku" {...form.register("sku")} className="uppercase" />
                {err("sku")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" {...form.register("name")} />
                {err("name")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-category">Category</Label>
                <select id="m-category" {...form.register("category")} className={select}>
                  {[
                    "flower",
                    "foliage",
                    "plant",
                    "container",
                    "wrap",
                    "accessory",
                    "consumable",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-unit">Unit</Label>
                <select id="m-unit" {...form.register("unit")} className={select}>
                  {["stem", "bunch", "piece", "gram", "millilitre", "metre"].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-shelf">Shelf life (days)</Label>
                <Input
                  id="m-shelf"
                  type="number"
                  min={1}
                  {...form.register("default_shelf_life_days")}
                />
                {err("default_shelf_life_days")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-low">Low-stock threshold</Label>
                <Input
                  id="m-low"
                  type="number"
                  min={0}
                  step="0.5"
                  {...form.register("low_stock_threshold")}
                />
                {err("low_stock_threshold")}
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="m-supplier">Default supplier</Label>
                <select
                  id="m-supplier"
                  {...form.register("default_supplier_id")}
                  className={select}
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("is_perishable")} /> Perishable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("is_active")} /> Active
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save material
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
