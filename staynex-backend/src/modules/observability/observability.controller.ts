import { Body, Controller, Headers, Post } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import { webVitalMetricSchema } from "./dto";
import { ObservabilityService } from "./observability.service";

@Controller("observability")
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Post("web-vitals")
  @RateLimit({
    bucket: "observability:web-vitals",
    limit: 240,
    windowMs: 60_000,
    keyBy: ["ip"],
  })
  async recordWebVital(
    @Body() body: unknown,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.observability.recordWebVital(parseBody(webVitalMetricSchema, body), userAgent);
  }
}
