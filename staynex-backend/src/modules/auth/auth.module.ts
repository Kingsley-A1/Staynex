import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { CapabilitiesGuard, SessionGuard } from "./access-control";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [AuthController, SettingsController],
  providers: [AuthService, SessionGuard, CapabilitiesGuard],
  exports: [AuthService, SessionGuard, CapabilitiesGuard],
})
export class AuthModule {}
