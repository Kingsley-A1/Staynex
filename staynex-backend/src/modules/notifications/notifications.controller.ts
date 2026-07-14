import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import { CurrentUser, SessionGuard } from "../auth/access-control";
import { DeviceTokensService } from "./device-tokens.service";
import { InboxService } from "./inbox.service";
import { inboxQuerySchema, markReadSchema, registerDeviceSchema } from "./dto";

/** Signed-in users' notification inbox + push-device registry. */
@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(
    private readonly inbox: InboxService,
    private readonly devices: DeviceTokensService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    const input = parseBody(inboxQuerySchema, query);
    return this.inbox.list(user.id, input.cursor, input.take);
  }

  @Get(":id")
  async getOne(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.inbox.getOne(user.id, id);
  }

  @Post("read")
  @RateLimit({
    bucket: "notifications:read",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async markRead(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.inbox.markRead(user.id, parseBody(markReadSchema, body).ids);
  }

  @Post("devices")
  @RateLimit({
    bucket: "notifications:devices",
    limit: 10,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async registerDevice(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = parseBody(registerDeviceSchema, body);
    return this.devices.register(user.id, input.token, input.platform);
  }

  @Delete("devices/:token")
  async removeDevice(@CurrentUser() user: AuthUser, @Param("token") token: string) {
    return this.devices.remove(user.id, token);
  }
}
