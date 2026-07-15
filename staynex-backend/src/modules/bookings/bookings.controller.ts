import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import { CurrentUser, SessionGuard } from "../auth/access-control";
import { AuthService } from "../auth/auth.service";
import { BookingsService } from "./bookings.service";
import { checkoutSchema, createHoldSchema, quoteSchema } from "./dto";

// Guest endpoints. Search/quote/hold work without an account; checkout (payment)
// requires a signed-in guest — registration happens just before payment.
@Controller()
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly auth: AuthService,
  ) {}

  @Post("bookings/quote")
  @RateLimit({
    bucket: "booking:quote",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["ip"],
  })
  quote(@Body() body: unknown) {
    return this.bookings.quote(parseBody(quoteSchema, body));
  }

  @Post("bookings/holds")
  @RateLimit({
    bucket: "booking:hold",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["ip"],
  })
  async createHold(
    @Headers("cookie") cookie: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.auth.resolve(cookie);
    return this.bookings.createHold(
      parseBody(createHoldSchema, body),
      user?.id ?? null,
    );
  }

  @Get("bookings/holds/:id")
  getHold(@Param("id") id: string) {
    return this.bookings.getHold(id);
  }

  @Post("checkout")
  @UseGuards(SessionGuard)
  @RateLimit({
    bucket: "booking:checkout",
    limit: 8,
    windowMs: 60_000,
    keyBy: ["user", "ip"],
  })
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Req() req: OriginRequest,
  ) {
    return this.bookings.checkout(
      parseBody(checkoutSchema, body),
      user.id,
      requestApiOrigin(req),
    );
  }

  /** The signed-in guest's booking history (trips), newest check-in first. */
  @Get("bookings")
  @UseGuards(SessionGuard)
  listBookings(@CurrentUser() user: AuthUser, @Query("limit") limit?: string) {
    const parsed = Number(limit);
    return this.bookings.listGuestBookings(
      user.id,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Get("bookings/:id")
  getBooking(@Param("id") id: string) {
    return this.bookings.getBooking(id);
  }
}

interface OriginRequest {
  protocol?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Public origin of this API for the current request, proxy-aware
 * (Railway sets x-forwarded-*; locally it falls back to the Host header).
 * Used only to build the server-controlled mobile payment-return URL.
 */
function requestApiOrigin(req: OriginRequest): string | null {
  const first = (v: string | string[] | undefined): string | null => {
    const raw = Array.isArray(v) ? v[0] : v;
    return raw ? raw.split(",")[0].trim() : null;
  };
  const proto = first(req.headers["x-forwarded-proto"]) ?? req.protocol ?? "http";
  const host = first(req.headers["x-forwarded-host"]) ?? first(req.headers["host"]);
  return host ? `${proto}://${host}` : null;
}
