import { Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/users")
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Headers("cookie") cookie: string | undefined) {
    await this.auth.requireAdmin(cookie);
    return this.users.listUsers();
  }

  @Get(":id")
  async detail(@Headers("cookie") cookie: string | undefined, @Param("id") id: string) {
    const admin = await this.auth.requireAdmin(cookie);
    return this.users.getUser(id, admin);
  }

  // Sensitive: reveal the full bank account number. Super Admin only; audited.
  @Post(":id/payout-method/reveal")
  async reveal(@Headers("cookie") cookie: string | undefined, @Param("id") id: string) {
    const manager = await this.auth.requireAdminManager(cookie);
    return this.users.revealPayoutMethod(manager, id);
  }
}
