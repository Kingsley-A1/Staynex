import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { AiController } from "./ai.controller";
import { AssistantService } from "./assistant.service";
import { GeminiService } from "./gemini.service";

@Module({
  imports: [CatalogModule],
  controllers: [AiController],
  providers: [GeminiService, AssistantService],
})
export class AiModule {}
