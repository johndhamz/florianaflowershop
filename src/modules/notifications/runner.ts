import "server-only";

import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

import {
  createResendProvider,
  disabledSmsProvider,
  type EmailProvider,
  logEmailProvider,
  type SmsProvider,
} from "./providers";
import { renderSms, renderTemplate } from "./templates";

export type RunSummary = {
  claimed: number;
  sent: number;
  failed: number;
  requeued: number;
};

export function getEmailProvider(): EmailProvider {
  const env = getServerEnv();
  return env.RESEND_API_KEY ? createResendProvider(env.RESEND_API_KEY) : logEmailProvider;
}

/**
 * Processes due outbox rows. Each row is claimed with `FOR UPDATE SKIP LOCKED`
 * (safe for concurrent runners), rendered, sent, and marked sent / requeued with
 * exponential backoff / failed after 5 attempts. Non-retryable provider errors
 * fail immediately.
 */
export async function runNotificationOutbox(
  opts: { limit?: number; email?: EmailProvider; sms?: SmsProvider } = {},
): Promise<RunSummary> {
  const env = getServerEnv();
  const admin = createAdminClient();
  const email = opts.email ?? getEmailProvider();
  const sms = opts.sms ?? disabledSmsProvider;
  const { data: settings } = await admin
    .from("business_settings")
    .select("shop_name, notifications_from_email, sms_enabled")
    .eq("id", 1)
    .maybeSingle();
  const shopName = settings?.shop_name ?? "Floriana Flowers";
  const from =
    settings?.notifications_from_email ?? "Floriana Flowers <orders@florianaflowers.ph>";

  const { data: rows, error } = await admin.rpc("claim_due_notifications", {
    p_limit: opts.limit ?? 25,
  });
  if (error) throw new Error(`claim_due_notifications: ${error.message}`);

  const summary: RunSummary = {
    claimed: rows?.length ?? 0,
    sent: 0,
    failed: 0,
    requeued: 0,
  };
  for (const row of rows ?? []) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    let result;
    if (row.channel === "email") {
      const rendered = renderTemplate({
        template: row.template,
        payload,
        siteUrl: env.NEXT_PUBLIC_SITE_URL,
        shopName,
      });
      result = await email.send({
        from,
        to: row.recipient,
        subject: row.subject ?? rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } else if (settings?.sms_enabled) {
      result = await sms.send({
        to: row.recipient,
        body: renderSms(row.template, payload, env.NEXT_PUBLIC_SITE_URL),
      });
    } else {
      result = {
        ok: false as const,
        provider: "disabled",
        error: "SMS disabled in settings.",
        retryable: false,
      };
    }

    if (result.ok) {
      await admin.rpc("mark_notification_result", {
        p_id: row.id,
        p_ok: true,
        p_provider: result.provider,
        p_provider_message_id: result.messageId,
      });
      summary.sent += 1;
    } else {
      await admin.rpc("mark_notification_result", {
        p_id: row.id,
        p_ok: false,
        p_provider: result.provider,
        p_error: result.error,
        p_max_attempts: result.retryable ? 5 : 1,
      });
      if (result.retryable && row.attempts < 5) summary.requeued += 1;
      else summary.failed += 1;
    }
  }
  return summary;
}
