import { Injectable, Logger } from "@nestjs/common";
import { createSign } from "node:crypto";

export interface PushMessage {
  title: string;
  body: string;
  /** In-app deep link opened when the notification is clicked. */
  linkUrl?: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  delivered: boolean;
  /** True when FCM reports the token is dead — caller must prune it. */
  deadToken: boolean;
  skippedReason?: string;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
/** Refresh the cached OAuth token this long before it actually expires. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

/**
 * Firebase Cloud Messaging over the HTTP v1 API (the legacy server-key API was
 * retired by Google in 2024). Authenticates with a service account read from
 * FIREBASE_SERVICE_ACCOUNT_KEY (raw JSON or base64 of it), self-signing the
 * OAuth JWT with node:crypto — no SDK dependency, mirroring the Paystack and
 * Resend integrations. Degrades gracefully: unconfigured returns
 * `delivered: false` instead of throwing, so callers record an honest state.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private account: ServiceAccount | null | undefined; // undefined = not parsed yet
  private accessToken: { value: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    return this.serviceAccount() !== null;
  }

  /** Send one message to one device token. Never throws. */
  async send(token: string, message: PushMessage): Promise<PushSendResult> {
    const account = this.serviceAccount();
    if (!account) {
      return { delivered: false, deadToken: false, skippedReason: "FCM not configured" };
    }

    try {
      const auth = await this.oauthToken(account);
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: {
                ...(message.data ?? {}),
                ...(message.linkUrl ? { link: message.linkUrl } : {}),
              },
              webpush: message.linkUrl
                ? { fcm_options: { link: absoluteLink(message.linkUrl) } }
                : undefined,
            },
          }),
        },
      );

      if (res.ok) return { delivered: true, deadToken: false };

      const json = (await res.json().catch(() => null)) as {
        error?: { status?: string; message?: string };
      } | null;
      const status = json?.error?.status ?? `HTTP ${res.status}`;
      // UNREGISTERED / NOT_FOUND = the device token is permanently dead.
      const deadToken = res.status === 404 || status === "UNREGISTERED";
      if (!deadToken) {
        this.logger.warn(`FCM send failed (${status}): ${json?.error?.message ?? ""}`);
      }
      return { delivered: false, deadToken, skippedReason: status };
    } catch (err) {
      this.logger.warn(
        `FCM send error: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return { delivered: false, deadToken: false, skippedReason: "network error" };
    }
  }

  // --- internals -----------------------------------------------------------

  /** Parse FIREBASE_SERVICE_ACCOUNT_KEY once (raw JSON or base64-encoded JSON). */
  private serviceAccount(): ServiceAccount | null {
    if (this.account !== undefined) return this.account;
    this.account = this.parseFullJson() ?? this.parseDiscreteVars();
    return this.account;
  }

  /**
   * Preferred: FIREBASE_SERVICE_ACCOUNT_KEY holding the entire service-account
   * JSON (raw or base64). JSON.parse turns the escaped `\n` in `private_key`
   * into real newlines automatically.
   */
  private parseFullJson(): ServiceAccount | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
    if (!raw || raw.includes("BEGIN PRIVATE KEY")) return null; // bare PEM → discrete path
    for (const candidate of [raw, tryBase64Decode(raw)]) {
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate) as Partial<ServiceAccount>;
        if (parsed.project_id && parsed.client_email && parsed.private_key) {
          return {
            project_id: parsed.project_id,
            client_email: parsed.client_email,
            private_key: normalizePrivateKey(parsed.private_key),
          };
        }
      } catch {
        /* try the next decoding */
      }
    }
    this.logger.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid service-account JSON (raw or base64).",
    );
    return null;
  }

  /**
   * Fallback: assemble from discrete vars — FIREBASE_PROJECT_ID,
   * FIREBASE_CLIENT_EMAIL, and the private key from FIREBASE_PRIVATE_KEY (or a
   * bare PEM left in FIREBASE_SERVICE_ACCOUNT_KEY).
   */
  private parseDiscreteVars(): ServiceAccount | null {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const keySource =
      process.env.FIREBASE_PRIVATE_KEY?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
    const privateKey = keySource ? normalizePrivateKey(keySource) : null;

    if (!privateKey?.includes("BEGIN PRIVATE KEY")) return null; // push simply off
    const missing: string[] = [];
    if (!projectId) missing.push("FIREBASE_PROJECT_ID");
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (missing.length > 0) {
      this.logger.error(
        `Firebase push is misconfigured: a private key is set but ${missing.join(" and ")} ${
          missing.length === 1 ? "is" : "are"
        } missing. Add ${missing.join("/")} — the client_email is the JWT issuer FCM requires.`,
      );
      return null;
    }
    return { project_id: projectId!, client_email: clientEmail!, private_key: privateKey };
  }

  /** Mint (and cache) an OAuth2 access token via a self-signed RS256 JWT. */
  private async oauthToken(account: ServiceAccount): Promise<string> {
    if (this.accessToken && Date.now() < this.accessToken.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.accessToken.value;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: account.client_email,
        scope: FCM_SCOPE,
        aud: TOKEN_ENDPOINT,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const signature = signer.sign(account.private_key).toString("base64url");
    const assertion = `${header}.${claims}.${signature}`;

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (!res.ok || !json?.access_token) {
      throw new Error(`FCM OAuth token exchange failed (HTTP ${res.status})`);
    }
    this.accessToken = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return this.accessToken.value;
  }
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function tryBase64Decode(input: string): string | null {
  try {
    const decoded = Buffer.from(input, "base64").toString("utf8");
    return decoded.startsWith("{") ? decoded : null;
  } catch {
    return null;
  }
}

/** Turn escaped `\n` sequences into real newlines so node:crypto can sign. */
function normalizePrivateKey(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

/** FCM webpush click links must be absolute; resolve against the app origin. */
function absoluteLink(linkUrl: string): string {
  if (/^https?:\/\//.test(linkUrl)) return linkUrl;
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${linkUrl.startsWith("/") ? "" : "/"}${linkUrl}`;
}
