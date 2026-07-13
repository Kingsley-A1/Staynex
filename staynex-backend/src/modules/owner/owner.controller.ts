import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import {
  CapabilitiesGuard,
  CurrentUser,
  RequireAnyCapability,
  SessionGuard,
} from "../auth/access-control";
import { AuthService } from "../auth/auth.service";
import { type CookieResponse, setSessionCookie } from "../auth/cookies";
import { OwnerService } from "./owner.service";
import {
  completeOnboardingSchema,
  createLocationSchema,
  ownerProfileSchema,
  payoutMethodSchema,
  updateLocationSchema,
  verifyPayoutAccountSchema,
} from "./dto";

@Controller("host")
@UseGuards(SessionGuard, CapabilitiesGuard)
export class OwnerController {
  constructor(
    private readonly owner: OwnerService,
    private readonly auth: AuthService,
  ) {}

  // Upgrade path: a signed-in guest becomes owner-capable without a new account.
  @Post("become")
  @RateLimit({
    bucket: "owner:become",
    limit: 3,
    windowMs: 15 * 60_000,
    keyBy: ["user"],
  })
  async become(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.grantOwnerCapabilityAndRotateSession(
      user.id,
    );
    setSessionCookie(res, result.token, result.expiresAt);
    return result.user;
  }

  // --- Onboarding ----------------------------------------------------------

  @Get("onboarding")
  @RequireAnyCapability("OWNER")
  async onboarding(@CurrentUser() owner: AuthUser) {
    return this.owner.getOnboardingState(owner);
  }

  @Post("onboarding/complete")
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "owner:onboarding-complete",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async completeOnboarding(
    @CurrentUser() owner: AuthUser,
    @Body() body: unknown,
  ) {
    const input = parseBody(completeOnboardingSchema, body);
    return this.owner.completeOnboarding(owner, input.skipPayout === true);
  }

  // --- Settings ------------------------------------------------------------

  @Get("settings")
  @RequireAnyCapability("OWNER")
  async settings(@CurrentUser() owner: AuthUser) {
    return this.owner.getSettings(owner);
  }

  @Patch("settings/profile")
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "owner:profile",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async updateProfile(@CurrentUser() owner: AuthUser, @Body() body: unknown) {
    return this.owner.updateProfile(owner, parseBody(ownerProfileSchema, body));
  }

  @Get("settings/locations")
  @RequireAnyCapability("OWNER")
  async listLocations(@CurrentUser() owner: AuthUser) {
    return this.owner.listLocations(owner.id);
  }

  @Post("settings/locations")
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "owner:location-create",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async createLocation(@CurrentUser() owner: AuthUser, @Body() body: unknown) {
    return this.owner.createLocation(
      owner.id,
      parseBody(createLocationSchema, body),
    );
  }

  @Patch("settings/locations/:id")
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "owner:location-update",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async updateLocation(
    @CurrentUser() owner: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.owner.updateLocation(
      owner.id,
      id,
      parseBody(updateLocationSchema, body),
    );
  }

  @Delete("settings/locations/:id")
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "owner:location-delete",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async deleteLocation(
    @CurrentUser() owner: AuthUser,
    @Param("id") id: string,
    @Query("replacementLocationId") replacementLocationId?: string,
  ) {
    return this.owner.deleteLocation(
      owner.id,
      id,
      replacementLocationId?.trim() || undefined,
    );
  }

  @Get("settings/payout-method")
  @RequireAnyCapability("OWNER")
  async getPayoutMethod(@CurrentUser() owner: AuthUser) {
    return this.owner.getPayoutMethod(owner.id);
  }

  @Get("settings/payout-banks")
  @RequireAnyCapability("OWNER")
  async listPayoutBanks() {
    return this.owner.listPayoutBanks();
  }

  @Post("settings/payout-method/verify")
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "owner:payout-account-verify",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async verifyPayoutAccount(@Body() body: unknown) {
    return this.owner.verifyPayoutAccount(
      parseBody(verifyPayoutAccountSchema, body),
    );
  }

  @Put("settings/payout-method")
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "owner:payout-method",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async upsertPayoutMethod(
    @CurrentUser() owner: AuthUser,
    @Body() body: unknown,
  ) {
    return this.owner.upsertPayoutMethod(
      owner.id,
      parseBody(payoutMethodSchema, body),
    );
  }
}
