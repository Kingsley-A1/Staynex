import { Controller, Get, HttpCode } from "@nestjs/common";
import { isDbConnectionError, prisma } from "../../../db";

@Controller("health")
export class HealthController {
  /** Liveness — the process is up and serving. Never touches the DB. */
  @Get()
  check() {
    return {
      status: "ok",
      service: "staynex-backend",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness — verifies the database is actually reachable. Returns 503 when the
   * DB is down so load balancers / uptime monitors can detect a real outage
   * instead of seeing a green liveness check while every query fails.
   */
  @Get("ready")
  @HttpCode(200)
  async ready() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "up", timestamp: new Date().toISOString() };
    } catch (err) {
      // Let the connection-class path become a 503 via the global filter; for
      // anything else, surface a generic degraded readiness signal.
      if (isDbConnectionError(err)) throw err;
      return { status: "degraded", db: "down", timestamp: new Date().toISOString() };
    }
  }
}
