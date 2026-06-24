import { Body, Controller, Get, Headers, Param, Put, Query } from "@nestjs/common";
import { parseBody, parseQuery, requiredHeader } from "../../common/http";
import { AvailabilityService } from "./availability.service";
import { calendarQuerySchema, setCapacitySchema } from "./dto";

@Controller("availability")
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("room-types/:roomTypeId")
  getCalendar(@Param("roomTypeId") roomTypeId: string, @Query() query: unknown) {
    const { from, to } = parseQuery(calendarQuerySchema, query);
    return this.availability.getCalendar(roomTypeId, from, to);
  }

  @Put("capacity")
  setCapacity(@Headers("x-user-id") ownerId: string, @Body() body: unknown) {
    return this.availability.setCapacity(
      requiredHeader(ownerId, "x-user-id"),
      parseBody(setCapacitySchema, body),
    );
  }
}
