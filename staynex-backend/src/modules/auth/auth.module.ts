import { forwardRef, Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { CapabilitiesGuard, SessionGuard } from "./access-control";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SettingsController } from "./settings.controller";

// AuthService needs EmailService (from NotificationsModule) and
// NotificationsController needs SessionGuard (from here) — a genuine mutual
// dependency. forwardRef on both sides is Nest's documented mechanism for it.
@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [AuthController, SettingsController],
  providers: [AuthService, SessionGuard, CapabilitiesGuard],
  exports: [AuthService, SessionGuard, CapabilitiesGuard],
})
export class AuthModule {}
