import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
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
  quote(@Body() body: unknown) {
    return this.bookings.quote(parseBody(quoteSchema, body));
  }

  @Post("bookings/holds")
  async createHold(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.auth.resolve(cookie, userId);
    return this.bookings.createHold(parseBody(createHoldSchema, body), user?.id ?? null);
  }

  @Get("bookings/holds/:id")
  getHold(@Param("id") id: string) {
    return this.bookings.getHold(id);
  }

  @Post("checkout")
  async checkout(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.auth.requireUser(cookie, userId);
    return this.bookings.checkout(parseBody(checkoutSchema, body), user.id);
  }

  @Get("bookings/:id")
  getBooking(@Param("id") id: string) {
    return this.bookings.getBooking(id);
  }
}
