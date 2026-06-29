import { Module } from "@nestjs/common";
import { RateLimiterService } from "../../common/rate-limiter";
import { AuthModule } from "../auth/auth.module";
import { CatalogModule } from "../catalog/catalog.module";
import { AiController } from "./ai.controller";
import { AssistantService } from "./assistant.service";
import { ConversationsService } from "./conversations.service";
import { GeminiService } from "./gemini.service";

@Module({
  imports: [CatalogModule, AuthModule],
  controllers: [AiController],
  providers: [GeminiService, AssistantService, ConversationsService, RateLimiterService],
})
export class AiModule {}
