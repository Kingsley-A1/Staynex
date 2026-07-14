import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PropertyReviewModule } from "../property-review/property-review.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [AuthModule, PropertyReviewModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
