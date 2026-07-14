import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { PropertiesService } from "./properties.service";
import { createPropertySchema, updatePropertySchema } from "./dto";

@Controller("host/properties")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("OWNER")
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  async list(@CurrentUser() owner: AuthUser) {
    return this.properties.listForOwner(owner.id);
  }

  @Post()
  @RateLimit({
    bucket: "owner:property-create",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async create(@CurrentUser() owner: AuthUser, @Body() body: unknown) {
    return this.properties.createDraft(
      owner.id,
      parseBody(createPropertySchema, body),
    );
  }

  @Get(":id")
  async get(@CurrentUser() owner: AuthUser, @Param("id") id: string) {
    return this.properties.getForOwner(owner.id, id);
  }

  @Patch(":id")
  @RateLimit({
    bucket: "owner:property-update",
    limit: 40,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async update(
    @CurrentUser() owner: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.properties.update(
      owner.id,
      id,
      parseBody(updatePropertySchema, body),
    );
  }

  @Post(":id/submit")
  @RateLimit({
    bucket: "owner:property-submit",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async submit(@CurrentUser() owner: AuthUser, @Param("id") id: string) {
    return this.properties.submitForReview(owner.id, id);
  }
}
