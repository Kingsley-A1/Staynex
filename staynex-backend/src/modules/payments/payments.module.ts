import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentEventsService } from "./payment-events.service";
import { PaystackService } from "./paystack.service";

@Module({
  imports: [NotificationsModule],
  providers: [PaystackService, PaymentEventsService],
  exports: [PaystackService, PaymentEventsService],
})
export class PaymentsModule {}
