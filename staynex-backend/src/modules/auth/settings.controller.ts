import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { CurrentUser, SessionGuard } from "./access-control";
import { AuthService } from "./auth.service";
import { updateProfileSchema } from "./dto";

// Basic account settings for any signed-in user. Owner/admin-specific settings
// live under /owner/settings and /admin. Kept thin — logic stays in AuthService.
@Controller("settings")
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(private readonly auth: AuthService) {}

  @Get("profile")
  async profile(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Patch("profile")
  async updateProfile(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.auth.updateProfile(user, parseBody(updateProfileSchema, body));
  }
}
