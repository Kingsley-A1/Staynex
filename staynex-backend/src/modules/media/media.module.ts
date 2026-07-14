import { Logger, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PropertyReviewModule } from "../property-review/property-review.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MediaSweeperService } from "./media-sweeper.service";
import { r2ConfigPresent, R2StorageProvider } from "./r2-storage.provider";
import { STORAGE_PROVIDER, StubStorageProvider, type StorageProvider } from "./storage";

const moduleLogger = new Logger("MediaModule");

@Module({
  imports: [AuthModule, PropertyReviewModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaSweeperService,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (): StorageProvider => {
        if (r2ConfigPresent()) return new R2StorageProvider();
        // In production a missing R2 config must stop the boot, not quietly
        // hand hosts an uploader that can never succeed.
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            "CLOUDFLARE_R2_* env vars are required in production — media uploads cannot run on the dev stub.",
          );
        }
        moduleLogger.warn(
          "CLOUDFLARE_R2_* env vars are not fully set — using the dev stub storage provider. " +
            "Upload PUTs will not succeed; attach flows are exercised in shape only.",
        );
        return new StubStorageProvider();
      },
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
