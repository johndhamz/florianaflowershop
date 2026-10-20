"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

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
import { saveSupplier } from "@/modules/inventory/actions";

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

const schema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(160),
  contact_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.email("Enter a valid email."), z.literal("")]).optional(),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
  is_active: z.boolean(),
});
type FormValues = z.input<typeof schema>;

export function SuppliersManager({
  suppliers,
  canEdit,
}: {
  suppliers: Supplier[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const open = (row: Supplier | "new") => {
    setEditing(row);
    form.reset(
      row === "new"
        ? {
            name: "",
            contact_name: "",
            phone: "",
            email: "",
            address: "",
            notes: "",
            is_active: true,
          }
        : {
            name: row.name,
            contact_name: row.contact_name ?? "",
            phone: row.phone ?? "",
            email: row.email ?? "",
            address: row.address ?? "",
            notes: row.notes ?? "",
            is_active: row.is_active,
          },
    );
  };
  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveSupplier({
        ...values,
        id: editing && editing !== "new" ? editing.id : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setEditing(null);
      router.refresh();
    });
  });
  const columns: DataTableColumn<Supplier>[] = [
    {
      id: "name",
      header: "Supplier",
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: "contact",
      header: "Contact",
      hideBelow: "sm",
      cell: (r) => (
        <span className="text-muted-foreground">
          {[r.contact_name, r.phone, r.email].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      id: "address",
      header: "Address",
      hideBelow: "lg",
      cell: (r) => <span className="text-muted-foreground">{r.address ?? "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.is_active ? (
          <StatusBadge tone="success">Active</StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot={false}>
            Inactive
          </StatusBadge>
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
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{suppliers.length} suppliers</p>
        {canEdit ? (
          <Button onClick={() => open("new")}>
            <PlusIcon data-icon="inline-start" />
            New supplier
          </Button>
        ) : null}
      </div>
      <DataTable
        columns={columns}
        rows={suppliers}
        getRowId={(r) => r.id}
        caption="Suppliers"
      />
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {editing === "new" ? "New supplier" : `Edit ${editing?.name ?? ""}`}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="s-name">Name</Label>
                <Input id="s-name" {...form.register("name")} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-contact">Contact person</Label>
                <Input id="s-contact" {...form.register("contact_name")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-phone">Phone</Label>
                <Input id="s-phone" {...form.register("phone")} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" type="email" {...form.register("email")} />
                {form.formState.errors.email ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="s-address">Address</Label>
                <Input id="s-address" {...form.register("address")} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="s-notes">Notes</Label>
                <Input id="s-notes" {...form.register("notes")} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("is_active")} /> Active
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save supplier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
