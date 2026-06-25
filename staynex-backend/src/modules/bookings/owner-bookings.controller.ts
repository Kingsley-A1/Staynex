import { Controller, Get, Headers, Param } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { BookingReportsService } from "./booking-reports.service";

// Reads are owner-scoped in the service so one owner can never see another
// owner's bookings.
@Controller("owner/bookings")
export class OwnerBookingsController {
  constructor(
    private readonly reports: BookingReportsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers("cookie") cookie: string | undefined,  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.reports.ownerView(owner.id);
  }

  @Get(":id")
  async detail(
    @Headers("cookie") cookie: string | undefined,    @Param("id") id: string,
  ) {
    const owner = await this.auth.requireOwner(cookie);
    return this.reports.ownerBooking(owner.id, id);
  }
}
