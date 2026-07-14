import { Module } from "@nestjs/common";
import { VoucherController } from "./voucher.controller";
import { VoucherService } from "./voucher.service";

/**
 * Booking vouchers: the canonical PDF (download + email attachment), its QR,
 * and the public verification card. Depends on nothing but Prisma, so
 * NotificationsModule can import it to attach the PDF without a module cycle.
 */
@Module({
  controllers: [VoucherController],
  providers: [VoucherService],
  exports: [VoucherService],
})
export class VouchersModule {}
