import { Injectable, Logger } from "@nestjs/common";
import type { MediaUploadTarget } from "../../../types";

export interface CreateUploadInput {
  key: string;
  contentType: string;
}

/**
 * Storage abstraction for media uploads. The owner UI requests an upload target,
 * uploads the file directly to the target, then attaches the resulting public URL
 * to a property/room. This keeps large media off the API.
 */
export interface StorageProvider {
  createUploadTarget(input: CreateUploadInput): Promise<MediaUploadTarget>;
  publicUrl(key: string): string;
}

export const STORAGE_PROVIDER = "STORAGE_PROVIDER";

/**
 * Credential-free dev/stub provider. Returns a deterministic upload target with
 * NO real R2 credentials and NO S3 SDK dependency, so the end-to-end media flow
 * is wired for Phase 2. Replace with an S3-compatible R2 provider that issues a
 * real presigned PUT before production (see Known limits).
 */
@Injectable()
export class StubStorageProvider implements StorageProvider {
  private readonly logger = new Logger(StubStorageProvider.name);
  private readonly publicBase =
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ?? "https://media.staynex.local";

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
}
