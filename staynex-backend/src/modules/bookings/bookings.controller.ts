import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
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
  async checkout(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.bookings.checkout(parseBody(checkoutSchema, body), user.id);
  }

  @Get("bookings/:id")
  getBooking(@Param("id") id: string) {
    return this.bookings.getBooking(id);
  }
}
