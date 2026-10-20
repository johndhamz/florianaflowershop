"use client";

import { CheckIcon, ExternalLinkIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
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
import { formatManila } from "@/lib/datetime";
import { formatCentavos } from "@/lib/money";
import { recordRefund, verifyBankTransfer } from "@/modules/payments/admin-actions";

export type PaymentRow = {
  id: string;
  provider: string;
  method: string | null;
  status: string;
  amountCentavos: number;
  attempt: number;
  reference: string | null;
  proofUrl: string | null;
  proofUploadedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  orderNumber: string;
  customerName: string;
  orderPaymentStatus: string;
};

const tone: Record<string, StatusTone> = {
  paid: "success",
  pending: "neutral",
  requires_action: "warning",
  failed: "danger",
  cancelled: "neutral",
  expired: "neutral",
  refunded: "info",
  partially_refunded: "info",
};

export function PaymentsTable({
  rows,
  canVerify,
}: {
  rows: PaymentRow[];
  canVerify: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refundFor, setRefundFor] = useState<PaymentRow | null>(null);

  const act = (
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else toast.success(res.message ?? "Done");
      router.refresh();
    });

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      id: "order",
      header: "Order",
      cell: (r) => <span className="font-medium">{r.orderNumber}</span>,
    },
    { id: "customer", header: "Customer", cell: (r) => r.customerName, hideBelow: "md" },
    {
      id: "provider",
      header: "Method",
      cell: (r) => (
        <span className="capitalize">
          {r.provider.replace("_", " ")}
          {r.method && r.method !== "bank_transfer" ? ` · ${r.method}` : ""}
        </span>
      ),
      hideBelow: "sm",
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (r) => (
        <span className="tabular-nums">{formatCentavos(r.amountCentavos)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge tone={tone[r.status] ?? "neutral"}>
          {r.status.replaceAll("_", " ")}
        </StatusBadge>
      ),
    },
    {
      id: "proof",
      header: "Proof",
      hideBelow: "lg",
      cell: (r) =>
        r.proofUrl ? (
          <a
            href={r.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-4"
          >
            View <ExternalLinkIcon aria-hidden className="size-3" />
          </a>
        ) : r.reference ? (
          <span className="text-muted-foreground">Ref {r.reference}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "when",
      header: "When",
      hideBelow: "lg",
      cell: (r) => (
        <span className="text-muted-foreground">
          {formatManila(r.paidAt ?? r.proofUploadedAt ?? r.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        canVerify ? (
          <div className="flex justify-end gap-1">
            {r.provider === "bank_transfer" &&
            ["pending", "requires_action"].includes(r.status) ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => verifyBankTransfer(r.id, true))}
                  aria-label={`Approve ${r.orderNumber}`}
                >
                  <CheckIcon data-icon="inline-start" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    act(() =>
                      verifyBankTransfer(r.id, false, "Could not match the transfer."),
                    )
                  }
                  aria-label={`Reject ${r.orderNumber}`}
                >
                  <XIcon data-icon="inline-start" /> Reject
                </Button>
              </>
            ) : null}
            {["paid", "partially_refunded"].includes(r.status) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setRefundFor(r)}
                aria-label={`Refund ${r.orderNumber}`}
              >
                <RotateCcwIcon data-icon="inline-start" /> Refund
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        caption="Payments"
      />
      <Dialog open={!!refundFor} onOpenChange={(o) => !o && setRefundFor(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!refundFor) return;
              const data = new FormData(e.currentTarget);
              const pesos = Number(data.get("amount"));
              const reason = String(data.get("reason") ?? "requested_by_customer") as
                "duplicate" | "fraudulent" | "requested_by_customer" | "others";
              const notes = String(data.get("notes") ?? "");
              setRefundFor(null);
              act(() =>
                recordRefund(refundFor.id, Math.round(pesos * 100), reason, notes),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Refund {refundFor?.orderNumber}</DialogTitle>
              <DialogDescription>
                Paid {refundFor ? formatCentavos(refundFor.amountCentavos) : ""}. Online
                payments are refunded through the gateway; bank transfers are recorded as
                manual refunds.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="refund-amount">Amount (₱)</Label>
                <Input
                  id="refund-amount"
                  name="amount"
                  type="number"
                  min={1}
                  step="0.01"
                  defaultValue={
                    refundFor ? (refundFor.amountCentavos / 100).toFixed(2) : ""
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="refund-reason">Reason</Label>
                <select
                  id="refund-reason"
                  name="reason"
                  className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
                  defaultValue="requested_by_customer"
                >
                  <option value="requested_by_customer">Requested by customer</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="fraudulent">Fraudulent</option>
                  <option value="others">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="refund-notes">Notes</Label>
                <Input id="refund-notes" name="notes" maxLength={255} required />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setRefundFor(null)}>
                Cancel
              </Button>
              <Button type="submit">Record refund</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
