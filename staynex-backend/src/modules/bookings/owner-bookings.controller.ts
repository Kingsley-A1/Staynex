import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../../types";
import {
  CapabilitiesGuard,
  CurrentUser,
  RequireAnyCapability,
  SessionGuard,
} from "../auth/access-control";
import { BookingReportsService } from "./booking-reports.service";

// Reads are owner-scoped in the service so one owner can never see another
// owner's bookings.
@Controller("owner/bookings")
@UseGuards(SessionGuard, CapabilitiesGuard)
@RequireAnyCapability("OWNER")
export class OwnerBookingsController {
  constructor(private readonly reports: BookingReportsService) {}

  @Get()
  async list(@CurrentUser() owner: AuthUser) {
    return this.reports.ownerView(owner.id);
  }

  @Get(":id")
  async detail(@CurrentUser() owner: AuthUser, @Param("id") id: string) {
    return this.reports.ownerBooking(owner.id, id);
  }
}
