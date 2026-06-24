import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
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
export class AdminAreasController {
  constructor(
    private readonly areas: AreasService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Query("city") city?: string,
  ) {
    await this.auth.requireAdmin(cookie, userId);
    return this.areas.adminList(city);
  }

  @Post()
  async create(
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
  ) {
    const admin = await this.auth.requireAdmin(cookie, userId);
    return this.areas.create(admin, parseBody(createAreaSchema, body));
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
  ) {
    const admin = await this.auth.requireAdmin(cookie, userId);
    return this.areas.update(admin, id, parseBody(updateAreaSchema, body));
  }
}
