import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { AreasService } from "./areas.service";
import { createAreaSchema, updateAreaSchema } from "./dto";

// Public: areas for a city (used by the search form after city selection).
@Controller("areas")
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  list(@Query("city") city?: string) {
    return city ? this.areas.listForCity(city) : Promise.resolve([]);
  }
}

// Admin: areas remain admin-editable.
@Controller("admin/areas")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("ADMIN_REVIEWER", "ADMIN_MANAGER")
export class AdminAreasController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  async list(@Query("city") city?: string) {
    return this.areas.adminList(city);
  }

  @Post()
  @RateLimit({
    bucket: "admin:area-create",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async create(@Body() body: unknown, @CurrentUser() admin: AuthUser) {
    return this.areas.create(admin, parseBody(createAreaSchema, body));
  }

  @Patch(":id")
  @RateLimit({
    bucket: "admin:area-update",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.areas.update(admin, id, parseBody(updateAreaSchema, body));
  }
}
