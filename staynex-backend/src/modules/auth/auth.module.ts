import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [AuthController, SettingsController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
