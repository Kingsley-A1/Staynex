import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { AdminService } from "./admin.service";
import { approvalActionSchema } from "./dto";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly auth: AuthService,
  ) {}

  @Get("approvals")
  async queue(
    @Headers("cookie") cookie: string | undefined,  ) {
    await this.auth.requireAdmin(cookie);
    return this.admin.approvalQueue();
  }

  @Get("approvals/:id")
  async review(
    @Headers("cookie") cookie: string | undefined,    @Param("id") id: string,
  ) {
    await this.auth.requireAdmin(cookie);
    return this.admin.getForReview(id);
  }

  @Post("approvals/:id/decision")
  async decide(
    @Headers("cookie") cookie: string | undefined,    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const admin = await this.auth.requireAdmin(cookie);
    return this.admin.review(
      admin,
      id,
      parseBody(approvalActionSchema, body),
    );
  }

  // --- Phase 4: operational overview (read-only) ---

  @Get("bookings")
  async bookings(
    @Headers("cookie") cookie: string | undefined,  ) {
    await this.auth.requireAdmin(cookie);
    return this.admin.bookingsOverview();
  }

  @Get("audit-logs")
  async auditLogs(
    @Headers("cookie") cookie: string | undefined,  ) {
    await this.auth.requireAdmin(cookie);
    return this.admin.auditLogs();
  }

  @Get("ai-logs")
  async aiLogs(
    @Headers("cookie") cookie: string | undefined,  ) {
    await this.auth.requireAdmin(cookie);
    return this.admin.aiLogs();
  }
}
