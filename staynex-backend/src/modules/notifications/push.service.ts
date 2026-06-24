import { Injectable, Logger } from "@nestjs/common";

export interface PushMessage {
  /** Device registration token. Owner device tokens are not captured yet (POC). */
  token?: string | null;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  delivered: boolean;
  skippedReason?: string;
}

/**
 * Firebase Cloud Messaging foundation. Intentionally a clean placeholder: until
 * FCM credentials and device-token capture exist, this logs the intent and
 * returns `delivered: false`. The call sites are already wired so enabling push
 * later is a drop-in (set FCM_SERVER_KEY + persist owner device tokens).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  isConfigured(): boolean {
    return Boolean(process.env.FCM_SERVER_KEY);
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!this.isConfigured()) {
      this.logger.debug(`Push skipped (FCM not configured): "${message.title}"`);
      return { delivered: false, skippedReason: "FCM not configured" };
    }
    if (!message.token) {
      this.logger.debug(`Push skipped (no device token): "${message.title}"`);
      return { delivered: false, skippedReason: "no device token" };
    }
    // Foundation: real FCM send (HTTP v1) goes here once device tokens are
    // captured. Kept a no-op so the POC never claims a push it cannot deliver.
    this.logger.log(`Push (foundation) would send "${message.title}" to ${message.token}`);
    return { delivered: false, skippedReason: "push delivery not enabled in POC" };
  }
}
