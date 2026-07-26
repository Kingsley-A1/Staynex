import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentEventsService } from "./payment-events.service";
import { PaymentProviderRegistry } from "./payment-provider.registry";
import { OpayProvider } from "./opay.provider";
import { PaystackProvider } from "./paystack.provider";
import { PaystackService } from "./paystack.service";
import { BankDirectoryService } from "./bank-directory.service";

@Module({
  imports: [NotificationsModule],
  providers: [
    PaystackService,
    PaystackProvider,
    OpayProvider,
    PaymentProviderRegistry,
    PaymentEventsService,
    BankDirectoryService,
  ],
  exports: [
    // PaystackService stays exported: the payout-side bank directory and
    // account resolution are Paystack-specific by design (payouts are out of
    // scope for the multi-provider payin work).
    PaystackService,
    PaymentProviderRegistry,
    PaymentEventsService,
    BankDirectoryService,
  ],
})
export class PaymentsModule {}
