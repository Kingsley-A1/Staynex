import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { VouchersModule } from "../vouchers/voucher.module";
import { DeviceTokensService } from "./device-tokens.service";
import { EmailService } from "./email.service";
import { InboxService } from "./inbox.service";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { PushService } from "./push.service";

@Module({
  imports: [forwardRef(() => AuthModule), VouchersModule],
  controllers: [NotificationsController],
  providers: [
    EmailService,
    PushService,
    DeviceTokensService,
    InboxService,
    NotificationsService,
    NotificationDispatcherService,
  ],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
