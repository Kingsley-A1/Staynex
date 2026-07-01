import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import {
  CapabilitiesGuard,
  CurrentUser,
  RequireAnyCapability,
  SessionGuard,
} from "../auth/access-control";
import { AdminService } from "./admin.service";
import { approvalActionSchema } from "./dto";

@Controller("admin")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("ADMIN_REVIEWER", "ADMIN_MANAGER")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("approvals")
  async queue() {
    return this.admin.approvalQueue();
  }

  @Get("approvals/:id")
  async review(@Param("id") id: string) {
    return this.admin.getForReview(id);
  }

  @Post("approvals/:id/decision")
  @RateLimit({
    bucket: "admin:approval-decision",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async decide(
    @CurrentUser() admin: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.admin.review(admin, id, parseBody(approvalActionSchema, body));
  }

  // --- Phase 4: operational overview (read-only) ---

  @Get("bookings")
  async bookings() {
    return this.admin.bookingsOverview();
  }

  // --- Phase A: owner payout settlement (manual) ---

  @Get("payouts")
  async payouts() {
    return this.admin.payoutQueue();
  }

  @Post("payouts/:id/paid")
  @RateLimit({
    bucket: "admin:payout-paid",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async markPayoutPaid(
    @CurrentUser() admin: AuthUser,
    @Param("id") id: string,
  ) {
    return this.admin.markPayoutPaid(admin, id);
  }

  @Get("audit-logs")
  async auditLogs() {
    return this.admin.auditLogs();
  }

  @Get("ai-logs")
  async aiLogs() {
    return this.admin.aiLogs();
  }
}
