import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PropertyAutoPublisherService } from "./property-auto-publisher.service";
import { PropertyReviewService } from "./property-review.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [PropertyReviewService, PropertyAutoPublisherService],
  exports: [PropertyReviewService],
})
export class PropertyReviewModule {}
