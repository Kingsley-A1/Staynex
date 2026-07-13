import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import {
  AdminAreasController,
  AdminCitiesController,
  AreasController,
} from "./areas.controller";
import { AreasService } from "./areas.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AreasController, AdminAreasController, AdminCitiesController],
  providers: [AreasService],
})
export class AreasModule {}
