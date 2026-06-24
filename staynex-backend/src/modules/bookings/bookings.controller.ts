import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { BookingsService } from "./bookings.service";
import { checkoutSchema, createHoldSchema, quoteSchema } from "./dto";

// Guest endpoints. Identity is optional (anonymous guests allowed); when present,
// `x-user-id` is the temporary auth stand-in.
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post("bookings/quote")
  quote(@Body() body: unknown) {
    return this.bookings.quote(parseBody(quoteSchema, body));
  }

  @Post("bookings/holds")
  createHold(@Headers("x-user-id") userId: string | undefined, @Body() body: unknown) {
    return this.bookings.createHold(parseBody(createHoldSchema, body), userId?.trim() || null);
  }

  @Get("bookings/holds/:id")
  getHold(@Param("id") id: string) {
    return this.bookings.getHold(id);
  }

  @Post("checkout")
  checkout(@Headers("x-user-id") userId: string | undefined, @Body() body: unknown) {
    return this.bookings.checkout(parseBody(checkoutSchema, body), userId?.trim() || null);
  }

  @Get("bookings/:id")
  getBooking(@Param("id") id: string) {
    return this.bookings.getBooking(id);
  }
}
