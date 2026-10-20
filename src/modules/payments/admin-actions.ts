"use server";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";

import { getPaymentProvider } from "./provider";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function verifyBankTransfer(
  paymentId: string,
  approve: boolean,
  note?: string,
): Promise<Result> {
  try {
    await requireStaff("payments.verify");
    const supabase = await createClient();
    const { error } = await supabase.rpc("verify_bank_transfer", {
      p_payment_id: paymentId,
      p_approve: approve,
      p_note: note,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      message: approve ? "Payment verified. Order confirmed." : "Payment rejected.",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Not allowed." };
  }
}

export async function recordRefund(
  paymentId: string,
  amountCentavos: number,
  reason: "duplicate" | "fraudulent" | "requested_by_customer" | "others",
  notes: string,
): Promise<Result> {
  try {
    await requireStaff("refunds.manage");
    if (!Number.isInteger(amountCentavos) || amountCentavos < 100)
      return { ok: false, error: "Refund amount must be at least ₱1.00." };
    const supabase = await createClient();
    const { data: payment, error: pErr } = await supabase
      .from("payments")
      .select("id, provider, provider_data, amount_centavos")
      .eq("id", paymentId)
      .single();
    if (pErr || !payment) return { ok: false, error: "Payment not found." };

    const idempotencyKey = `refund:${paymentId}:${randomUUID()}`;
    let providerRefundId: string | null = null;
    let status: "pending" | "succeeded" | "failed" = "succeeded";

    if (payment.provider === "paymongo") {
      const settled = (payment.provider_data as { settled_payment_id?: string } | null)
        ?.settled_payment_id;
      if (!settled)
        return {
          ok: false,
          error:
            "No settled provider payment id on this record; refund manually in the PayMongo dashboard.",
        };
      const res = await getPaymentProvider().createRefund({
        providerPaymentId: settled,
        amountCentavos,
        reason,
        notes,
      });
      providerRefundId = res.providerRefundId;
      status =
        res.status === "failed"
          ? "failed"
          : res.status === "succeeded"
            ? "succeeded"
            : "pending";
    }

    const { error } = await supabase.rpc("record_refund", {
      p_payment_id: paymentId,
      p_idempotency_key: idempotencyKey,
      p_amount_centavos: amountCentavos,
      p_reason: `${reason}: ${notes}`.slice(0, 500),
      p_status: status,
      p_provider_refund_id: providerRefundId ?? undefined,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      message:
        status === "pending" ? "Refund requested with the gateway." : "Refund recorded.",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Refund failed." };
  }
}
