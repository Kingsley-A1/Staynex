import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { OwnerService } from "./owner.service";
import {
  completeOnboardingSchema,
  createLocationSchema,
  ownerProfileSchema,
  payoutMethodSchema,
  updateLocationSchema,
} from "./dto";

@Controller("owner")
export class OwnerController {
  constructor(
    private readonly owner: OwnerService,
    private readonly auth: AuthService,
  ) {}

  // Upgrade path: a signed-in guest becomes owner-capable without a new account.
  @Post("become")
  async become(@Headers("cookie") cookie: string | undefined) {
    const user = await this.auth.requireUser(cookie);
    return this.auth.grantOwnerCapability(user.id);
  }

  // --- Onboarding ----------------------------------------------------------

  @Get("onboarding")
  async onboarding(@Headers("cookie") cookie: string | undefined) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.getOnboardingState(owner);
  }

  @Post("onboarding/complete")
  async completeOnboarding(
    @Headers("cookie") cookie: string | undefined,
    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    const input = parseBody(completeOnboardingSchema, body);
    return this.owner.completeOnboarding(owner, input.skipPayout === true);
  }

  // --- Settings ------------------------------------------------------------

  @Get("settings")
  async settings(@Headers("cookie") cookie: string | undefined) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.getSettings(owner);
  }

  @Patch("settings/profile")
  async updateProfile(@Headers("cookie") cookie: string | undefined, @Body() body: unknown) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.updateProfile(owner, parseBody(ownerProfileSchema, body));
  }

  @Get("settings/locations")
  async listLocations(@Headers("cookie") cookie: string | undefined) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.listLocations(owner.id);
  }

  @Post("settings/locations")
  async createLocation(@Headers("cookie") cookie: string | undefined, @Body() body: unknown) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.createLocation(owner.id, parseBody(createLocationSchema, body));
  }

  @Patch("settings/locations/:id")
  async updateLocation(
    @Headers("cookie") cookie: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.updateLocation(owner.id, id, parseBody(updateLocationSchema, body));
  }

  @Delete("settings/locations/:id")
  async deleteLocation(
    @Headers("cookie") cookie: string | undefined,
    @Param("id") id: string,
    @Query("replacementLocationId") replacementLocationId?: string,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.deleteLocation(owner.id, id, replacementLocationId?.trim() || undefined);
  }

  @Get("settings/payout-method")
  async getPayoutMethod(@Headers("cookie") cookie: string | undefined) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.getPayoutMethod(owner.id);
  }

  @Put("settings/payout-method")
  async upsertPayoutMethod(@Headers("cookie") cookie: string | undefined, @Body() body: unknown) {
    const owner = await this.auth.requireOwner(cookie);
    return this.owner.upsertPayoutMethod(owner.id, parseBody(payoutMethodSchema, body));
  }
}
