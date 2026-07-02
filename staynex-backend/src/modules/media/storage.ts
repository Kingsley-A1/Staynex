import { Injectable, Logger } from "@nestjs/common";
import type { MediaUploadTarget } from "../../../types";

export interface CreateUploadInput {
  key: string;
  contentType: string;
}

/** What storage reports about an uploaded object (attach-time verification). */
export interface StoredObjectInfo {
  contentType: string | null;
  sizeBytes: number;
}

/** Minimal listing entry used by the orphan sweeper. */
export interface StoredObjectSummary {
  key: string;
  lastModified: Date;
}

/**
 * Storage abstraction for media uploads. The host UI requests an upload target,
 * uploads the file directly to the target, then attaches the object BY KEY. The
 * backend verifies the object (exists, is an allowed image, within size) before
 * persisting anything — the client never supplies a URL. This keeps large media
 * off the API without trusting client input.
 */
export interface StorageProvider {
  createUploadTarget(input: CreateUploadInput): Promise<MediaUploadTarget>;
  publicUrl(key: string): string;
  /** Storage key for a public URL under this provider's base, else null. */
  keyForUrl(url: string): string | null;
  /** Metadata for an uploaded object, or null when it doesn't exist. */
  headObject(key: string): Promise<StoredObjectInfo | null>;
  deleteObject(key: string): Promise<void>;
  /** Objects under `prefix` last modified before `olderThan` (bounded). */
  listObjects(prefix: string, olderThan: Date, max: number): Promise<StoredObjectSummary[]>;
}

export const STORAGE_PROVIDER = "STORAGE_PROVIDER";

/**
 * Credential-free dev/local fallback. Used only when R2 credentials are not
 * configured (never in production — see `MediaModule`), so local development
 * without cloud storage still exercises the request/attach flow shape. The
 * `uploadUrl` does not resolve to a real host, and `headObject` reports a
 * plausible image so the attach step can be exercised too.
 */
@Injectable()
export class StubStorageProvider implements StorageProvider {
  private readonly logger = new Logger(StubStorageProvider.name);
  private readonly publicBase = (
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ?? "https://media.staynex.local"
  ).replace(/\/+$/, "");

  async createUploadTarget(input: CreateUploadInput): Promise<MediaUploadTarget> {
    this.logger.debug(`stub upload target for ${input.key} (${input.contentType})`);
    return {
      key: input.key,
      uploadUrl: `${this.publicBase}/__stub-upload/${encodeURIComponent(input.key)}`,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      publicUrl: this.publicUrl(input.key),
      expiresInSeconds: 900,
    };
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  keyForUrl(url: string): string | null {
    const prefix = `${this.publicBase}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  async headObject(key: string): Promise<StoredObjectInfo | null> {
    this.logger.debug(`stub head for ${key} — reporting a small JPEG`);
    return { contentType: "image/jpeg", sizeBytes: 1024 };
  }

  async deleteObject(key: string): Promise<void> {
    this.logger.debug(`stub delete for ${key}`);
  }

  async listObjects(): Promise<StoredObjectSummary[]> {
    return [];
  }
}
