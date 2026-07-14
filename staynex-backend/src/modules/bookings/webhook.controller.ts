import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  Res,
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

/** Minimal structural response type for the one HTML page this API serves. */
interface HtmlResponse {
  setHeader(name: string, value: string): void;
  send(body: string): void;
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

  /**
   * Mobile payment-return interstitial. Paystack redirects the in-app browser
   * here after a mobile checkout; the page immediately deep-links back into
   * the app (`staynex://payment/<reference>`), which resolves the app's
   * `openAuthSessionAsync` and closes the browser. It carries NO payment
   * truth — the app still polls `GET /payments/:reference` for state, and the
   * reference format is validated so nothing user-controlled reaches the HTML.
   */
  @Get(":reference/mobile-return")
  mobileReturn(
    @Param("reference") reference: string,
    @Res() res: HtmlResponse,
  ) {
    if (!/^stx_[A-Za-z0-9]{8,64}$/.test(reference)) {
      throw new NotFoundException("Unknown payment reference");
    }
    const deepLink = `staynex://payment/${reference}`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Returning to Staynex…</title>
<style>
  body{margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;
       background:#F7F7FF;color:#101014;font-family:system-ui,-apple-system,sans-serif}
  main{text-align:center;padding:24px;max-width:340px}
  a.btn{display:inline-block;margin-top:16px;padding:14px 28px;border-radius:12px;
        background:#27187D;color:#fff;text-decoration:none;font-weight:600}
  p{color:#6E6A83;font-size:14px;line-height:1.5}
</style>
</head>
<body>
<main>
  <h1 style="font-size:20px">Returning to the Staynex app…</h1>
  <p>We're confirming your payment in the app. If nothing happens,
     tap the button below.</p>
  <a class="btn" href="${deepLink}">Open Staynex</a>
  <p>You can close this window once the app opens.</p>
</main>
<script>window.location.replace(${JSON.stringify(deepLink)});</script>
</body>
</html>`);
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
