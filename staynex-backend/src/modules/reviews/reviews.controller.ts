import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { ReviewsService } from "./reviews.service";
import { createReviewSchema } from "./dto";

// Public + guest-authenticated testimonial endpoints. Only APPROVED testimonials
// are returned publicly; submitting requires a signed-in guest with a valid
// booking context.
@Controller("reviews")
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@Query("propertySlug") propertySlug?: string, @Query("limit") limit?: string) {
    const n = limit ? Number.parseInt(limit, 10) : undefined;
    return this.reviews.publicList(propertySlug, Number.isFinite(n) ? n : undefined);
  }

  @Get("booking/:bookingId/context")
  async context(
    @Param("bookingId") bookingId: string,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
  ) {
    const user = await this.auth.requireUser(cookie, userId);
    return this.reviews.bookingContext(bookingId, user);
  }

  @Post("booking/:bookingId")
  async create(
    @Param("bookingId") bookingId: string,
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
  ) {
    const user = await this.auth.requireUser(cookie, userId);
    return this.reviews.create(bookingId, user, parseBody(createReviewSchema, body));
  }
}
