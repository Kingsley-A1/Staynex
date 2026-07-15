import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
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
import {
  adminListQuerySchema,
  approvalActionSchema,
  markPayoutFailedSchema,
  markPayoutPaidSchema,
  refundPaymentSchema,
} from "./dto";

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

  // --- Money operations: searchable lists, exception queue, actions --------

  @Get("bookings")
  async bookings(@Query() query: Record<string, string>) {
    return this.admin.listBookings(parseBody(adminListQuerySchema, query));
  }

  @Get("payments")
  async payments(@Query() query: Record<string, string>) {
    return this.admin.listPayments(parseBody(adminListQuerySchema, query));
  }

  /** Payments where money moved but a human action is owed. Must trend to empty. */
  @Get("payments/exceptions")
  async paymentExceptions() {
    return this.admin.paymentExceptions();
  }

  @Post("payments/:reference/reverify")
  @RateLimit({
    bucket: "admin:payment-reverify",
    limit: 15,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async reverifyPayment(
    @CurrentUser() admin: AuthUser,
    @Param("reference") reference: string,
  ) {
    return this.admin.reverifyPayment(admin, reference);
  }

  @Post("payments/:reference/refund")
  @RateLimit({
    bucket: "admin:payment-refund",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async refundPayment(
    @CurrentUser() admin: AuthUser,
    @Param("reference") reference: string,
    @Body() body: unknown,
  ) {
    return this.admin.refundPayment(
      admin,
      reference,
      parseBody(refundPaymentSchema, body).note,
    );
  }

  /** Availability counters vs derived truth (empty = clean books). */
  @Get("reconciliation/availability")
  async availabilityDrift() {
    return this.admin.availabilityDrift();
  }

  @Get("performance")
  async performance() {
    return this.admin.performance();
  }

  // --- Phase A: owner payout settlement (manual) ---------------------------

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
    @Body() body: unknown,
  ) {
    return this.admin.markPayoutPaid(admin, id, parseBody(markPayoutPaidSchema, body));
  }

  @Post("payouts/:id/failed")
  @RateLimit({
    bucket: "admin:payout-failed",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async markPayoutFailed(
    @CurrentUser() admin: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.admin.markPayoutFailed(
      admin,
      id,
      parseBody(markPayoutFailedSchema, body).reason,
    );
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
