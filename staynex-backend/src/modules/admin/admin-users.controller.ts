import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { RateLimit } from "../../common/rate-limit.guard";
import {
  CapabilitiesGuard,
  CurrentUser,
  RequireAnyCapability,
  SessionGuard,
} from "../auth/access-control";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/users")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("ADMIN_REVIEWER", "ADMIN_MANAGER")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  async list() {
    return this.users.listUsers();
  }

  @Get(":id")
  async detail(@CurrentUser() admin: AuthUser, @Param("id") id: string) {
    return this.users.getUser(id, admin);
  }

  // Sensitive: reveal the full bank account number. Super Admin only; audited.
  @Post(":id/payout-method/reveal")
  @RequireAnyCapability("ADMIN_MANAGER")
  @RateLimit({
    bucket: "admin:payout-reveal",
    limit: 5,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async reveal(@CurrentUser() manager: AuthUser, @Param("id") id: string) {
    return this.users.revealPayoutMethod(manager, id);
  }
}
