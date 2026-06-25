import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { TestimonialStatus } from "@prisma/client";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { ReviewsService } from "./reviews.service";
import { moderateReviewSchema } from "./dto";

function parseStatus(value?: string): TestimonialStatus | undefined {
  return value && value in TestimonialStatus ? (value as TestimonialStatus) : undefined;
}

@Controller("admin/testimonials")
export class AdminReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers("cookie") cookie: string | undefined,    @Query("status") status?: string,
  ) {
    await this.auth.requireAdmin(cookie);
    return this.reviews.adminList(parseStatus(status));
  }

  @Post(":id/decision")
  async decide(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,  ) {
    const admin = await this.auth.requireAdmin(cookie);
    return this.reviews.moderate(admin, id, parseBody(moderateReviewSchema, body));
  }
}
