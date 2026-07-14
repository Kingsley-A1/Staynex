import { Global, Module } from "@nestjs/common";
import { RateLimitGuard } from "./rate-limit.guard";
import { RateLimiterService } from "./rate-limiter";

@Global()
@Module({
  providers: [RateLimiterService, RateLimitGuard],
  exports: [RateLimiterService, RateLimitGuard],
})
export class SecurityModule {}
