import { Logger, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PropertyReviewModule } from "../property-review/property-review.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { r2ConfigPresent, R2StorageProvider } from "./r2-storage.provider";
import { STORAGE_PROVIDER, StubStorageProvider, type StorageProvider } from "./storage";

const moduleLogger = new Logger("MediaModule");

@Module({
  imports: [AuthModule, PropertyReviewModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (): StorageProvider => {
        if (r2ConfigPresent()) return new R2StorageProvider();
        moduleLogger.warn(
          "CLOUDFLARE_R2_* env vars are not fully set — owner media uploads will fail. " +
            "Falling back to the non-functional dev stub.",
        );
        return new StubStorageProvider();
      },
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
