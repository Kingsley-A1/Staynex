import { Module } from "@nestjs/common";
import { SecurityModule } from "./common/security.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AiModule } from "./modules/ai/ai.module";
import { AreasModule } from "./modules/areas/areas.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { HealthModule } from "./modules/health/health.module";
import { MediaModule } from "./modules/media/media.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ObservabilityModule } from "./modules/observability/observability.module";
import { OwnerModule } from "./modules/owner/owner.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { RoomsModule } from "./modules/rooms/rooms.module";
import { SupportModule } from "./modules/support/support.module";
import { UsersModule } from "./modules/users/users.module";
import { VouchersModule } from "./modules/vouchers/voucher.module";

@Module({
  imports: [
    SecurityModule,
    AuthModule,
    HealthModule,
    UsersModule,
    PropertiesModule,
    RoomsModule,
    AvailabilityModule,
    BookingsModule,
    CatalogModule,
    AreasModule,
    ReviewsModule,
    OwnerModule,
    ObservabilityModule,
    PaymentsModule,
    NotificationsModule,
    MediaModule,
    AdminModule,
    AiModule,
    AuditModule,
    SupportModule,
    VouchersModule,
  ],
})
export class AppModule {}
