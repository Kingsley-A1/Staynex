import { Body, Controller, Get, Headers, Patch } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "./auth.service";
import { updateProfileSchema } from "./dto";

// Basic account settings for any signed-in user. Owner/admin-specific settings
// live under /owner/settings and /admin. Kept thin — logic stays in AuthService.
@Controller("settings")
export class SettingsController {
  constructor(private readonly auth: AuthService) {}

  @Get("profile")
  async profile(@Headers("cookie") cookie: string | undefined) {
    return this.auth.requireUser(cookie);
  }

  @Patch("profile")
  async updateProfile(@Body() body: unknown, @Headers("cookie") cookie: string | undefined) {
    const user = await this.auth.requireUser(cookie);
    return this.auth.updateProfile(user, parseBody(updateProfileSchema, body));
  }
}
