import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { PaymentsWebhookController } from "./webhook.controller";

@Module({
  imports: [PaymentsModule],
  controllers: [BookingsController, PaymentsWebhookController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
