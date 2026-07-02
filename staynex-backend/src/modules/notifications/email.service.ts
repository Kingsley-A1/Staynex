import { Injectable, Logger } from "@nestjs/common";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  delivered: boolean;
  providerId: string | null;
  skippedReason?: string;
}

const DEFAULT_FROM = "Staynex <support@staynexbookings.ng>";
const RESEND_TEST_SENDER = "onboarding@resend.dev";

/**
 * Thin Resend integration (HTTP, no SDK dependency — mirrors PaystackService).
 * Reads secrets at call time so the API boots without email configured. When
 * unconfigured it returns `delivered: false` instead of throwing, so callers
 * (e.g. booking confirmation) can record a "queued, not sent" notification
 * without failing the surrounding flow.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  private from(): string {
    return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
  }

  private unsafeSenderReason(from: string): string | null {
    if (
      process.env.NODE_ENV === "production" &&
      from.toLowerCase().includes(RESEND_TEST_SENDER)
    ) {
      return `${RESEND_TEST_SENDER} is a Resend test sender and cannot deliver to real users in production`;
    }
    return null;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      this.logger.warn(
        `Email not sent (RESEND_API_KEY missing): "${message.subject}"`,
      );
      return {
        delivered: false,
        providerId: null,
        skippedReason: "RESEND_API_KEY missing",
      };
    }
    const from = this.from();
    const unsafeReason = this.unsafeSenderReason(from);
    if (unsafeReason) {
      this.logger.error(`Email not sent: ${unsafeReason}`);
      return {
        delivered: false,
        providerId: null,
        skippedReason: unsafeReason,
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          ...(message.text ? { text: message.text } : {}),
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        id?: string;
        message?: string;
      } | null;
      if (!res.ok || !json?.id) {
        this.logger.error(`Resend send failed: ${json?.message ?? res.status}`);
        return {
          delivered: false,
          providerId: null,
          skippedReason: json?.message ?? `HTTP ${res.status}`,
        };
      }
      return { delivered: true, providerId: json.id };
    } catch (err) {
      this.logger.error(
        `Resend send error: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return {
        delivered: false,
        providerId: null,
        skippedReason: "network error",
      };
    }
  }
}
