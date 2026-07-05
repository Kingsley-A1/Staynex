import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { BookingMaintenanceService } from "./booking-maintenance.service";
import { BookingReportsService } from "./booking-reports.service";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { OwnerBookingsController } from "./owner-bookings.controller";
import { PaymentsWebhookController } from "./webhook.controller";

@Module({
  imports: [PaymentsModule, NotificationsModule, AuthModule],
  controllers: [BookingsController, OwnerBookingsController, PaymentsWebhookController],
  providers: [BookingsService, BookingReportsService, BookingMaintenanceService],
  exports: [BookingsService, BookingReportsService, BookingMaintenanceService],
})
export class BookingsModule {}
