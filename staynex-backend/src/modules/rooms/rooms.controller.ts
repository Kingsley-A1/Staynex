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
import { RoomsService } from "./rooms.service";
import {
  createRoomTypeSchema,
  createRoomUnitSchema,
  updateRoomTypeSchema,
} from "./dto";

@Controller("host")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("OWNER")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get("properties/:propertyId/room-types")
  async listTypes(
    @CurrentUser() owner: AuthUser,
    @Param("propertyId") propertyId: string,
  ) {
    return this.rooms.listRoomTypes(owner.id, propertyId);
  }

  @Post("room-types")
  @RateLimit({
    bucket: "owner:room-type-create",
    limit: 30,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async createType(@CurrentUser() owner: AuthUser, @Body() body: unknown) {
    return this.rooms.createRoomType(
      owner.id,
      parseBody(createRoomTypeSchema, body),
    );
  }

  @Patch("room-types/:id")
  @RateLimit({
    bucket: "owner:room-type-update",
    limit: 40,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async updateType(
    @CurrentUser() owner: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.rooms.updateRoomType(
      owner.id,
      id,
      parseBody(updateRoomTypeSchema, body),
    );
  }

  @Get("room-types/:roomTypeId/units")
  async listUnits(
    @CurrentUser() owner: AuthUser,
    @Param("roomTypeId") roomTypeId: string,
  ) {
    return this.rooms.listRoomUnits(owner.id, roomTypeId);
  }

  @Post("room-units")
  @RateLimit({
    bucket: "owner:room-unit-create",
    limit: 60,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async addUnit(@CurrentUser() owner: AuthUser, @Body() body: unknown) {
    return this.rooms.addRoomUnit(
      owner.id,
      parseBody(createRoomUnitSchema, body),
    );
  }
}
