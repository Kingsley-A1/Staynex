import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { STORAGE_PROVIDER, StubStorageProvider } from "./storage";

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    { provide: STORAGE_PROVIDER, useClass: StubStorageProvider },
  ],
  exports: [MediaService],
})
export class MediaModule {}
