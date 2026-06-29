import { type ArgumentsHost, Catch, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { isDbConnectionError } from "../../db";

interface MinimalResponse {
  status(code: number): MinimalResponse;
  header(name: string, value: string): MinimalResponse;
  json(body: unknown): unknown;
}

/**
 * Translates transient database connection failures into an honest HTTP 503
 * (Service Unavailable) with a clean JSON body, instead of leaking a 500 + Prisma
 * stack trace. A brief CockroachDB blip is retryable, so we signal that to the
 * client (`retryable: true`) and set `Retry-After`. Every other exception is
 * delegated to Nest's default handler, so existing behaviour is unchanged.
 */
@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly dbLogger = new Logger("Database");

  catch(exception: unknown, host: ArgumentsHost): void {
    if (!isDbConnectionError(exception)) {
      super.catch(exception, host);
      return;
    }

    this.dbLogger.error(
      "Database temporarily unreachable — returning 503 (transient, retryable).",
    );
    const res = host.switchToHttp().getResponse<MinimalResponse>();
    res
      .status(503)
      .header("Retry-After", "5")
      .json({
        statusCode: 503,
        error: "Service Unavailable",
        message:
          "The service is temporarily unavailable. Please retry in a few seconds.",
        retryable: true,
      });
  }
}
