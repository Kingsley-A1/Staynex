import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentEventsService } from "./payment-events.service";
import { PaystackService } from "./paystack.service";
import { BankDirectoryService } from "./bank-directory.service";

@Module({
  imports: [NotificationsModule],
  providers: [PaystackService, PaymentEventsService, BankDirectoryService],
  exports: [PaystackService, PaymentEventsService, BankDirectoryService],
})
export class PaymentsModule {}
