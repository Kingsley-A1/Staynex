import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import { RateLimit } from "../../common/rate-limit.guard";
import { PaystackService } from "../payments/paystack.service";
import {
  PaymentEventsService,
  type PaymentOutcomeResult,
} from "../payments/payment-events.service";
import { BookingsService } from "./bookings.service";

interface PaystackEvent {
  event: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    transaction_reference?: string;
  };
}

@Controller("payments")
export class PaymentsWebhookController {
  constructor(
    private readonly paystack: PaystackService,
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
  async webhook(
    @Headers("x-paystack-signature") signature: string | undefined,
    @Req() req: RawBodyRequest<IncomingMessage>,
  ) {
    const raw = req.rawBody;
    if (!raw || !this.paystack.verifySignature(raw, signature)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
    let event: PaystackEvent;
    try {
      event = JSON.parse(raw.toString("utf8")) as PaystackEvent;
    } catch {
      throw new BadRequestException("Invalid webhook payload");
    }

    // Refund events reference the original transaction via a separate field.
    const reference = event.data?.reference ?? event.data?.transaction_reference ?? null;
    let result: PaymentOutcomeResult;
    try {
      result = await this.process(event, reference);
    } catch (err) {
      // Record the failed delivery, then rethrow: the non-2xx response makes
      // the provider retry, and the audit row proves the attempt happened.
      await this.paymentEvents.record({
        eventType: event.event,
        reference,
        outcome: "NO_CHANGE",
        detail: `Processing failed: ${err instanceof Error ? err.message : "unknown"} — provider will retry.`,
        payload: event,
      });
      throw err;
    }

    await this.paymentEvents.record({
      eventType: event.event,
      reference,
      outcome: result.outcome,
      detail: result.detail,
      payload: event,
    });
    return { received: true };
  }

  private async process(
    event: PaystackEvent,
    reference: string | null,
  ): Promise<PaymentOutcomeResult> {
    if (!reference) {
      return { outcome: "RECORDED", detail: "Event carried no transaction reference." };
    }
    switch (event.event) {
      case "charge.success":
        return this.bookings.applyChargeSuccess(reference, {
          amountKobo: event.data?.amount ?? null,
          currency: event.data?.currency ?? null,
        });
      case "charge.failed":
        return this.bookings.applyChargeFailure(reference);
      case "refund.processed":
        return this.bookings.applyRefund(reference, "provider (refund.processed)");
      default:
        if (event.event.startsWith("refund.") || event.event.startsWith("charge.dispute.")) {
          return {
            outcome: "RECORDED",
            detail: "Money-relevant event stored for the admin timeline; no automatic transition.",
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
