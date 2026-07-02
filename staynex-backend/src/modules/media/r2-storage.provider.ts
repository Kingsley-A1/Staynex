import { Injectable, Logger } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { MediaUploadTarget } from "../../../types";
import type { CreateUploadInput, StorageProvider } from "./storage";

const SIGNED_URL_TTL_SECONDS = 900;

/**
 * Cloudflare R2 storage provider. R2 speaks the S3 API, so presigned uploads
 * use the official AWS S3 SDK against R2's S3-compatible endpoint (this is
 * Cloudflare's own documented approach — see R2's "Presigned URLs" guide).
 *
 * IMPORTANT (infra, not code): the R2 bucket must have a CORS policy allowing
 * PUT from the frontend's origin(s) (production domain + localhost for dev),
 * or the browser's direct-to-storage upload will fail before it ever reaches
 * this signature. Configure this in the Cloudflare dashboard or via the R2
 * API — it cannot be set from application code.
 */
@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly client: S3Client;

  constructor() {
    const accountId = requiredEnv("CLOUDFLARE_R2_ACCOUNT_ID");
    const accessKeyId = requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    this.bucket = requiredEnv("CLOUDFLARE_R2_BUCKET");
    // Falls back to the R2 dev subdomain convention if no custom/public domain
    // is configured; a custom domain (CLOUDFLARE_R2_PUBLIC_BASE_URL) is
    // recommended for production so URLs aren't tied to account internals.
    this.publicBase = (
      process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ?? `https://${this.bucket}.${accountId}.r2.dev`
    ).replace(/\/+$/, "");

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // R2 only supports path-style addressing (bucket in the path, not as a
      // hostname subdomain) — without this the SDK defaults to virtual-hosted
      // style and produces a URL for a host that doesn't exist.
      forcePathStyle: true,
      // Without this, the SDK bakes a CRC32 checksum for an EMPTY body into
      // the presigned URL's query string (computed before the real file is
      // known), which R2 then rejects once the browser PUTs actual content.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  async createUploadTarget(input: CreateUploadInput): Promise<MediaUploadTarget> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
    this.logger.debug(`presigned R2 PUT for ${input.key}`);
    return {
      key: input.key,
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      publicUrl: this.publicUrl(input.key),
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    };
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to use the R2 storage provider`);
  return value;
}

/** True once every credential the R2 provider needs is present. */
export function r2ConfigPresent(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.CLOUDFLARE_R2_BUCKET?.trim(),
  );
}
