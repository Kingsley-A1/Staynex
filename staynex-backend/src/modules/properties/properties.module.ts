import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PropertyReviewModule } from "../property-review/property-review.module";
import { PropertiesController } from "./properties.controller";
import { PropertiesService } from "./properties.service";

@Module({
  imports: [AuthModule, PropertyReviewModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
