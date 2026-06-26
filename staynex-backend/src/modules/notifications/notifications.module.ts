import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { NotificationsService } from "./notifications.service";
import { PushService } from "./push.service";

@Module({
  providers: [EmailService, PushService, NotificationsService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
