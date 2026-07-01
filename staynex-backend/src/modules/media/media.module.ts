import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PropertyReviewModule } from "../property-review/property-review.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { STORAGE_PROVIDER, StubStorageProvider } from "./storage";

@Module({
  imports: [AuthModule, PropertyReviewModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    { provide: STORAGE_PROVIDER, useClass: StubStorageProvider },
  ],
  exports: [MediaService],
})
export class MediaModule {}
