import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { TestimonialStatus } from "@prisma/client";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import {
  CapabilitiesGuard,
  CurrentUser,
  RequireAnyCapability,
  SessionGuard,
} from "../auth/access-control";
import { ReviewsService } from "./reviews.service";
import { moderateReviewSchema } from "./dto";

function parseStatus(value?: string): TestimonialStatus | undefined {
  return value && value in TestimonialStatus
    ? (value as TestimonialStatus)
    : undefined;
}

@Controller("admin/testimonials")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("ADMIN_REVIEWER", "ADMIN_MANAGER")
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(@Query("status") status?: string) {
    return this.reviews.adminList(parseStatus(status));
  }

  @Post(":id/decision")
  @RateLimit({
    bucket: "admin:testimonial-decision",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async decide(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.reviews.moderate(
      admin,
      id,
      parseBody(moderateReviewSchema, body),
    );
  }
}
