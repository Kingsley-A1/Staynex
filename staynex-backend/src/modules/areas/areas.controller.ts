import {
  Body,
  Controller,
  Delete,
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
import {
  createAreaSchema,
  createCitySchema,
  updateAreaSchema,
  updateCitySchema,
} from "./dto";

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
  @RequireAnyCapability("ADMIN_MANAGER")
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
  @RequireAnyCapability("ADMIN_MANAGER")
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

  @Delete(":id")
  @RequireAnyCapability("ADMIN_MANAGER")
  @RateLimit({
    bucket: "admin:area-delete",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async remove(@Param("id") id: string, @CurrentUser() admin: AuthUser) {
    return this.areas.deleteArea(admin, id);
  }
}

@Controller("admin/cities")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("ADMIN_REVIEWER", "ADMIN_MANAGER")
export class AdminCitiesController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  list() {
    return this.areas.adminCityList();
  }

  @Get("reference")
  reference() {
    return this.areas.locationReferences();
  }

  @Post()
  @RequireAnyCapability("ADMIN_MANAGER")
  @RateLimit({
    bucket: "admin:city-create",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  create(@Body() body: unknown, @CurrentUser() admin: AuthUser) {
    return this.areas.createCity(admin, parseBody(createCitySchema, body));
  }

  @Patch(":id")
  @RequireAnyCapability("ADMIN_MANAGER")
  @RateLimit({
    bucket: "admin:city-update",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.areas.updateCity(admin, id, parseBody(updateCitySchema, body));
  }

  @Delete(":id")
  @RequireAnyCapability("ADMIN_MANAGER")
  @RateLimit({
    bucket: "admin:city-delete",
    limit: 20,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  remove(@Param("id") id: string, @CurrentUser() admin: AuthUser) {
    return this.areas.deleteCity(admin, id);
  }
}
