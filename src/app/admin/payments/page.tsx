import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentsTable } from "@/components/admin/payments-table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";

export const metadata: Metadata = { title: "Payments" };

async function PaymentsList() {
  const staff = await requireStaff("payments.read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, provider, method, status, amount_centavos, attempt, provider_reference, proof_storage_path, proof_uploaded_at, paid_at, created_at, orders ( order_number, customer_name, payment_status )",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  // Signed URLs for proofs (private bucket), only for roles that may view them.
  const rows = await Promise.all(
    (data ?? []).map(async (p) => {
      let proofUrl: string | null = null;
      if (p.proof_storage_path) {
        const { data: signed } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(p.proof_storage_path, 60 * 10);
        proofUrl = signed?.signedUrl ?? null;
      }
      return {
        id: p.id,
        provider: p.provider,
        method: p.method,
        status: p.status,
        amountCentavos: p.amount_centavos,
        attempt: p.attempt,
        reference: p.provider_reference,
        proofUrl,
        proofUploadedAt: p.proof_uploaded_at,
        paidAt: p.paid_at,
        createdAt: p.created_at,
        orderNumber: p.orders?.order_number ?? "—",
        customerName: p.orders?.customer_name ?? "—",
        orderPaymentStatus: p.orders?.payment_status ?? "unpaid",
      };
    }),
  );
  return (
    <PaymentsTable
      rows={rows}
      canVerify={staff.role === "owner" || staff.role === "manager"}
    />
  );
}

export default function AdminPaymentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Payments"
        description="Verify bank transfers, review online payments, and record refunds."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={6} />}>
        <PaymentsList />
      </Suspense>
    </div>
  );
}
