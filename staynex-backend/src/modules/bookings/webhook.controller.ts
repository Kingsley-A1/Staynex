import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import { RateLimit } from "../../common/rate-limit.guard";
import { PaymentProviderRegistry } from "../payments/payment-provider.registry";
import type {
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderName,
} from "../payments/payment-provider.port";
import {
  PaymentEventsService,
  type PaymentOutcomeResult,
} from "../payments/payment-events.service";
import { BookingsService } from "./bookings.service";

@Controller("payments")
export class PaymentsWebhookController {
  constructor(
    private readonly providers: PaymentProviderRegistry,
    private readonly bookings: BookingsService,
    private readonly paymentEvents: PaymentEventsService,
  ) {}

  /**
   * Paystack webhook. Every signature-verified delivery is persisted to the
   * PaymentEvent audit trail together with its processing outcome — a money
   * event can never be dropped invisibly (payment-review P1). Unhandled but
   * money-relevant event families (refunds, disputes) are at least RECORDED.
   */
  @Post("paystack/webhook")
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<IncomingMessage>) {
    return this.handle("paystack", req);
  }

  /**
   * Opay webhook. A separate route with its own verifier by design — there is
   * deliberately no shared "try every provider's signature" path, which would
   * weaken authenticity to that of the weakest scheme.
   */
  @Post("opay/webhook")
  @HttpCode(200)
  opayWebhook(@Req() req: RawBodyRequest<IncomingMessage>) {
    return this.handle("opay", req);
  }

  /**
   * Shared delivery pipeline: verify signature -> parse -> apply -> audit.
   * Both providers get identical audit and outcome behaviour; only signature
   * verification and payload parsing differ, and those live in the adapter.
   */
  private async handle(
    providerName: ProviderName,
    req: RawBodyRequest<IncomingMessage>,
  ) {
    const provider = this.providers.get(providerName);
    const raw = req.rawBody;
    if (!raw || !provider.verifySignature(raw, req.headers)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    let event: NormalizedWebhookEvent;
    try {
      event = provider.parseWebhook(raw);
    } catch {
      throw new BadRequestException("Invalid webhook payload");
    }

    let result: PaymentOutcomeResult;
    try {
      result = await this.process(provider, event);
    } catch (err) {
      // Record the failed delivery, then rethrow: the non-2xx response makes
      // the provider retry, and the audit row proves the attempt happened.
      await this.paymentEvents.record({
        eventType: event.rawType,
        provider: provider.name,
        reference: event.reference,
        outcome: "NO_CHANGE",
        detail: `Processing failed: ${err instanceof Error ? err.message : "unknown"} — provider will retry.`,
        payload: event.payload,
      });
      throw err;
    }

    await this.paymentEvents.record({
      eventType: event.rawType,
      provider: provider.name,
      reference: event.reference,
      outcome: result.outcome,
      detail: result.detail,
      payload: event.payload,
    });
    return { received: true };
  }

  private async process(
    provider: PaymentProvider,
    event: NormalizedWebhookEvent,
  ): Promise<PaymentOutcomeResult> {
    if (!event.reference) {
      return {
        outcome: "RECORDED",
        detail: "Event carried no transaction reference.",
      };
    }
    switch (event.kind) {
      case "charge.success":
        return this.bookings.applyChargeSuccess(event.reference, {
          amountKobo: event.amountKobo,
          currency: event.currency,
        });
      case "charge.failed":
        return this.bookings.applyChargeFailure(event.reference);
      case "refund.processed":
        return this.bookings.applyRefund(
          event.reference,
          `${provider.name} (refund webhook: ${event.rawType})`,
        );
      default:
        if (
          event.rawType.startsWith("refund.") ||
          event.rawType.startsWith("charge.dispute.")
        ) {
          return {
            outcome: "RECORDED",
            detail:
              "Money-relevant event stored for the admin timeline; no automatic transition.",
          };
        }
        return { outcome: "RECORDED", detail: "Unhandled event type." };
    }
  }

  // Polled by the payment-status page. Rate-limited because each poll can
  // trigger a (debounced) provider verify (payment-review P8).
  @Get(":reference")
  @RateLimit({
    bucket: "payments:status",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["ip"],
  })
  status(@Param("reference") reference: string) {
    return this.bookings.getPaymentStatus(reference);
  }
}
