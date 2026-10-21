"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatManila } from "@/lib/datetime";
import { formatCentavos } from "@/lib/money";
import { savePromo } from "@/modules/promotions/actions";

export type PromoRow = {
  id: string;
  code: string;
  description: string | null;
  promo_type: "percent" | "fixed";
  value: number;
  min_subtotal_centavos: number;
  max_discount_centavos: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses_count: number;
  per_customer_limit: number | null;
  first_order_only: boolean;
  eligible_collection_ids: string[];
  is_active: boolean;
  redemptions: number;
  discount_given_centavos: number;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const manila = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return `${manila.getFullYear()}-${String(manila.getMonth() + 1).padStart(2, "0")}-${String(manila.getDate()).padStart(2, "0")}T${String(manila.getHours()).padStart(2, "0")}:${String(manila.getMinutes()).padStart(2, "0")}`;
}

export function PromotionsManager({
  promos,
  collections,
  canEdit,
}: {
  promos: PromoRow[];
  collections: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<PromoRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const p = editing === "new" ? null : editing;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await savePromo({
        id: p?.id,
        code: String(fd.get("code")),
        description: String(fd.get("description") ?? ""),
        promo_type: String(fd.get("promo_type")) as "percent",
        value: Number(fd.get("value")),
        min_subtotal_pesos: Number(fd.get("min") || 0),
        max_discount_pesos: fd.get("max_discount")
          ? Number(fd.get("max_discount"))
          : null,
        starts_at: String(fd.get("starts_at") ?? "")
          ? `${String(fd.get("starts_at"))}:00+08:00`
          : undefined,
        ends_at: String(fd.get("ends_at") ?? "")
          ? `${String(fd.get("ends_at"))}:00+08:00`
          : undefined,
        max_uses: fd.get("max_uses") ? Number(fd.get("max_uses")) : null,
        per_customer_limit: fd.get("per_customer")
          ? Number(fd.get("per_customer"))
          : null,
        first_order_only: fd.get("first_order_only") === "on",
        eligible_collection_ids: fd.getAll("collections").map(String),
        is_active: fd.get("is_active") === "on",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setEditing(null);
      router.refresh();
    });
  };

  const columns: DataTableColumn<PromoRow>[] = [
    {
      id: "code",
      header: "Code",
      cell: (r) => (
        <div>
          <p className="font-mono font-medium">{r.code}</p>
          <p className="text-xs text-muted-foreground">{r.description ?? ""}</p>
        </div>
      ),
    },
    {
      id: "disc",
      header: "Discount",
      cell: (r) =>
        r.promo_type === "percent"
          ? `${r.value}%${r.max_discount_centavos ? ` (max ${formatCentavos(r.max_discount_centavos)})` : ""}`
          : formatCentavos(r.value),
    },
    {
      id: "rules",
      header: "Rules",
      hideBelow: "md",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {[
            r.min_subtotal_centavos
              ? `min ${formatCentavos(r.min_subtotal_centavos)}`
              : null,
            r.first_order_only ? "first order only" : null,
            r.per_customer_limit ? `${r.per_customer_limit}/customer` : null,
            r.eligible_collection_ids.length
              ? `${r.eligible_collection_ids.length} collection(s)`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      ),
    },
    {
      id: "window",
      header: "Valid",
      hideBelow: "lg",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.starts_at ? formatManila(r.starts_at, { dateStyle: "medium" }) : "now"} →{" "}
          {r.ends_at ? formatManila(r.ends_at, { dateStyle: "medium" }) : "no end"}
        </span>
      ),
    },
    {
      id: "uses",
      header: "Uses",
      align: "right",
      cell: (r) => (
        <span className="tabular-nums">
          {r.uses_count}
          {r.max_uses ? ` / ${r.max_uses}` : ""}
        </span>
      ),
    },
    {
      id: "given",
      header: "Discount given",
      align: "right",
      hideBelow: "sm",
      cell: (r) => (
        <span className="tabular-nums">{formatCentavos(r.discount_given_centavos)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => {
        const expired = r.ends_at ? new Date(r.ends_at) < new Date() : false;
        const exhausted = r.max_uses ? r.uses_count >= r.max_uses : false;
        return !r.is_active ? (
          <StatusBadge tone="neutral" dot={false}>
            Inactive
          </StatusBadge>
        ) : expired ? (
          <StatusBadge tone="danger" dot={false}>
            Expired
          </StatusBadge>
        ) : exhausted ? (
          <StatusBadge tone="warning" dot={false}>
            Exhausted
          </StatusBadge>
        ) : (
          <StatusBadge tone="success">Live</StatusBadge>
        );
      },
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
            onClick={() => setEditing(r)}
            aria-label={`Edit ${r.code}`}
          >
            Edit
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{promos.length} codes</p>
        {canEdit ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            New promotion
          </Button>
        ) : null}
      </div>
      <DataTable
        columns={columns}
        rows={promos}
        getRowId={(r) => r.id}
        caption="Promotions"
      />
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <DialogHeader>
              <DialogTitle>
                {editing === "new" ? "New promotion" : `Edit ${p?.code ?? ""}`}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-code">Code</Label>
                <Input
                  id="pr-code"
                  name="code"
                  required
                  defaultValue={p?.code ?? ""}
                  className="font-mono uppercase"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-type">Type</Label>
                <select
                  id="pr-type"
                  name="promo_type"
                  defaultValue={p?.promo_type ?? "percent"}
                  className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
                >
                  <option value="percent">Percent off</option>
                  <option value="fixed">Fixed amount (₱)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="pr-desc">Description</Label>
                <Input
                  id="pr-desc"
                  name="description"
                  defaultValue={p?.description ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-value">Value (% or ₱)</Label>
                <Input
                  id="pr-value"
                  name="value"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={
                    p ? (p.promo_type === "percent" ? p.value : p.value / 100) : ""
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-max">Max discount (₱, optional)</Label>
                <Input
                  id="pr-max"
                  name="max_discount"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={
                    p?.max_discount_centavos ? p.max_discount_centavos / 100 : ""
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-min">Minimum goods subtotal (₱)</Label>
                <Input
                  id="pr-min"
                  name="min"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={p ? p.min_subtotal_centavos / 100 : 0}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-uses">Max total uses</Label>
                <Input
                  id="pr-uses"
                  name="max_uses"
                  type="number"
                  min={1}
                  defaultValue={p?.max_uses ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-start">Starts (Manila)</Label>
                <Input
                  id="pr-start"
                  name="starts_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(p?.starts_at ?? null)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-end">Ends (Manila)</Label>
                <Input
                  id="pr-end"
                  name="ends_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(p?.ends_at ?? null)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-per">Uses per customer</Label>
                <Input
                  id="pr-per"
                  name="per_customer"
                  type="number"
                  min={1}
                  defaultValue={p?.per_customer_limit ?? ""}
                />
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm">Eligible collections (blank = all)</legend>
                {collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="collections"
                      value={c.id}
                      defaultChecked={p?.eligible_collection_ids.includes(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="first_order_only"
                  defaultChecked={p?.first_order_only ?? false}
                />{" "}
                First order only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={p?.is_active ?? true}
                />{" "}
                Active
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save promotion
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
