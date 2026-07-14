import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody, parseQuery } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import {
  CapabilitiesGuard,
  CurrentUser,
  RequireAnyCapability,
  SessionGuard,
} from "../auth/access-control";
import { AvailabilityService } from "./availability.service";
import { calendarQuerySchema, setCapacitySchema } from "./dto";

@Controller("availability")
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("room-types/:roomTypeId")
  getCalendar(
    @Param("roomTypeId") roomTypeId: string,
    @Query() query: unknown,
  ) {
    const { from, to } = parseQuery(calendarQuerySchema, query);
    return this.availability.getCalendar(roomTypeId, from, to);
  }

  @Put("capacity")
  @UseGuards(SessionGuard, CapabilitiesGuard)
  @RequireAnyCapability("OWNER")
  @RateLimit({
    bucket: "availability:capacity",
    limit: 60,
    windowMs: 60_000,
    keyBy: ["user"],
  })
  async setCapacity(@CurrentUser() owner: AuthUser, @Body() body: unknown) {
    return this.availability.setCapacity(
      owner.id,
      parseBody(setCapacitySchema, body),
    );
  }
}
