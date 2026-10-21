import "server-only";

export type SendResult =
  | { ok: true; provider: string; messageId?: string }
  | { ok: false; provider: string; error: string; retryable: boolean };

export interface EmailProvider {
  readonly id: string;
  send(input: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<SendResult>;
}
export interface SmsProvider {
  readonly id: string;
  send(input: { to: string; body: string }): Promise<SendResult>;
}

/** Resend transactional email: POST https://api.resend.com/emails (Bearer API key). */
export function createResendProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): EmailProvider {
  return {
    id: "resend",
    async send({ from, to, subject, html, text }) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, provider: "resend", messageId: json.id };
      }
      const body = await res.text().catch(() => "");
      // 4xx (bad address, invalid key) won't fix itself; 429/5xx will.
      return {
        ok: false,
        provider: "resend",
        error: `Resend ${res.status}: ${body.slice(0, 200)}`,
        retryable: res.status === 429 || res.status >= 500,
      };
    },
  };
}

/** Development/CI provider: records sends in memory and logs them. */
export const logEmailProvider: EmailProvider & {
  sent: { to: string; subject: string }[];
} = {
  id: "log",
  sent: [],
  async send({ to, subject }) {
    this.sent.push({ to, subject });
    console.info(`[notifications] email → ${to}: ${subject}`);
    return { ok: true, provider: "log", messageId: `log_${Date.now()}` };
  },
};

/** SMS is optional and disabled by default; no gateway is wired yet. */
export const disabledSmsProvider: SmsProvider = {
  id: "disabled",
  async send() {
    return {
      ok: false,
      provider: "disabled",
      error: "SMS sending is not configured.",
      retryable: false,
    };
  },
};
