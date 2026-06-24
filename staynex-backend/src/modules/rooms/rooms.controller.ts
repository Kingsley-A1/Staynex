import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { parseBody, requiredHeader } from "../../common/http";
import { RoomsService } from "./rooms.service";
import { createRoomTypeSchema, createRoomUnitSchema, updateRoomTypeSchema } from "./dto";

@Controller("owner")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get("properties/:propertyId/room-types")
  listTypes(@Headers("x-user-id") ownerId: string, @Param("propertyId") propertyId: string) {
    return this.rooms.listRoomTypes(requiredHeader(ownerId, "x-user-id"), propertyId);
  }

  @Post("room-types")
  createType(@Headers("x-user-id") ownerId: string, @Body() body: unknown) {
    return this.rooms.createRoomType(
      requiredHeader(ownerId, "x-user-id"),
      parseBody(createRoomTypeSchema, body),
    );
  }

  @Patch("room-types/:id")
  updateType(
    @Headers("x-user-id") ownerId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.rooms.updateRoomType(
      requiredHeader(ownerId, "x-user-id"),
      id,
      parseBody(updateRoomTypeSchema, body),
    );
  }

  @Get("room-types/:roomTypeId/units")
  listUnits(@Headers("x-user-id") ownerId: string, @Param("roomTypeId") roomTypeId: string) {
    return this.rooms.listRoomUnits(requiredHeader(ownerId, "x-user-id"), roomTypeId);
  }

  @Post("room-units")
  addUnit(@Headers("x-user-id") ownerId: string, @Body() body: unknown) {
    return this.rooms.addRoomUnit(
      requiredHeader(ownerId, "x-user-id"),
      parseBody(createRoomUnitSchema, body),
    );
  }
}
