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
import { PaystackService } from "../payments/paystack.service";
import { BookingsService } from "./bookings.service";

interface PaystackEvent {
  event: string;
  data?: { reference?: string; amount?: number; status?: string };
}

@Controller("payments")
export class PaymentsWebhookController {
  constructor(
    private readonly paystack: PaystackService,
    private readonly bookings: BookingsService,
  ) {}

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
    const reference = event.data?.reference;
    if (reference) {
      if (event.event === "charge.success") {
        await this.bookings.confirmByReference(reference, event.data?.amount ?? null);
      } else if (event.event === "charge.failed") {
        await this.bookings.failByReference(reference);
      }
    }
    return { received: true };
  }

  // Polled by the payment-status page.
  @Get(":reference")
  status(@Param("reference") reference: string) {
    return this.bookings.getPaymentStatus(reference);
  }
}
