"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { unitLabel } from "@/components/admin/inventory/qty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordWastage } from "@/modules/inventory/actions";

type Batch = {
  id: string;
  code: string;
  material: string;
  unit: string;
  available: number;
};
const schema = z.object({
  batch_id: z.uuid({ message: "Choose a batch." }),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  reason: z.enum(["damaged", "expired", "wilted", "lost", "other"]),
  note: z.string().trim().max(300).optional(),
});
type FormValues = z.input<typeof schema>;

export function WastageForm({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      batch_id: "",
      quantity: "" as unknown as number,
      reason: "damaged",
      note: "",
    },
  });
  const batch = batches.find((b) => b.id === form.watch("batch_id"));
  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await recordWastage(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      form.reset({
        batch_id: "",
        quantity: "" as unknown as number,
        reason: "damaged",
        note: "",
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
      className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
      aria-busy={pending}
    >
      <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
        <Trash2Icon aria-hidden className="size-4 text-destructive" />
        Record wastage
      </h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wf-batch">Batch</Label>
        <select
          id="wf-batch"
          {...form.register("batch_id")}
          className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">Choose a batch…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.material} · {b.code} · {b.available} {unitLabel(b.unit)} available
            </option>
          ))}
        </select>
        {err("batch_id")}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wf-qty">
          Quantity{batch ? ` (max ${batch.available} ${unitLabel(batch.unit)})` : ""}
        </Label>
        <Input
          id="wf-qty"
          type="number"
          step="any"
          min={0}
          {...form.register("quantity")}
          className="h-10 bg-background"
        />
        {err("quantity")}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wf-reason">Reason</Label>
        <select
          id="wf-reason"
          {...form.register("reason")}
          className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="damaged">Damaged</option>
          <option value="wilted">Wilted</option>
          <option value="expired">Expired</option>
          <option value="lost">Lost</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wf-note">Note</Label>
        <Input id="wf-note" {...form.register("note")} className="h-10 bg-background" />
      </div>
      <Button type="submit" disabled={pending}>
        Record wastage
      </Button>
    </form>
  );
}
