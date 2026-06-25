import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { RoomsService } from "./rooms.service";
import { createRoomTypeSchema, createRoomUnitSchema, updateRoomTypeSchema } from "./dto";

@Controller("owner")
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly auth: AuthService,
  ) {}

  @Get("properties/:propertyId/room-types")
  async listTypes(
    @Headers("cookie") cookie: string | undefined,    @Param("propertyId") propertyId: string,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.rooms.listRoomTypes(owner.id, propertyId);
  }

  @Post("room-types")
  async createType(
    @Headers("cookie") cookie: string | undefined,    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.rooms.createRoomType(
      owner.id,
      parseBody(createRoomTypeSchema, body),
    );
  }

  @Patch("room-types/:id")
  async updateType(
    @Headers("cookie") cookie: string | undefined,    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.rooms.updateRoomType(
      owner.id,
      id,
      parseBody(updateRoomTypeSchema, body),
    );
  }

  @Get("room-types/:roomTypeId/units")
  async listUnits(
    @Headers("cookie") cookie: string | undefined,    @Param("roomTypeId") roomTypeId: string,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.rooms.listRoomUnits(owner.id, roomTypeId);
  }

  @Post("room-units")
  async addUnit(
    @Headers("cookie") cookie: string | undefined,    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.rooms.addRoomUnit(
      owner.id,
      parseBody(createRoomUnitSchema, body),
    );
  }
}
