import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import { CurrentUser, SessionGuard } from "../auth/access-control";
import { ReviewsService } from "./reviews.service";
import { createReviewSchema } from "./dto";

// Public + guest-authenticated testimonial endpoints. Only APPROVED testimonials
// are returned publicly; submitting requires a signed-in guest with a valid
// booking context.
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(
    @Query("propertySlug") propertySlug?: string,
    @Query("limit") limit?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : undefined;
    return this.reviews.publicList(
      propertySlug,
      Number.isFinite(n) ? n : undefined,
    );
  }

  @Get("booking/:bookingId/context")
  @UseGuards(SessionGuard)
  async context(
    @Param("bookingId") bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.bookingContext(bookingId, user);
  }

  @Post("booking/:bookingId")
  @UseGuards(SessionGuard)
  @RateLimit({
    bucket: "reviews:create",
    limit: 5,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async create(
    @Param("bookingId") bookingId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.create(
      bookingId,
      user,
      parseBody(createReviewSchema, body),
    );
  }
}
