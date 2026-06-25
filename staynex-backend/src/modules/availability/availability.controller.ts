import { Body, Controller, Get, Headers, Param, Put, Query } from "@nestjs/common";
import { parseBody, parseQuery } from "../../common/http";
import { AuthService } from "../auth/auth.service";
import { AvailabilityService } from "./availability.service";
import { calendarQuerySchema, setCapacitySchema } from "./dto";

@Controller("availability")
export class AvailabilityController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly auth: AuthService,
  ) {}

  @Get("room-types/:roomTypeId")
  getCalendar(@Param("roomTypeId") roomTypeId: string, @Query() query: unknown) {
    const { from, to } = parseQuery(calendarQuerySchema, query);
    return this.availability.getCalendar(roomTypeId, from, to);
  }

  @Put("capacity")
  async setCapacity(
    @Headers("cookie") cookie: string | undefined,    @Body() body: unknown,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.availability.setCapacity(
      owner.id,
      parseBody(setCapacitySchema, body),
    );
  }
}
