import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AppCapability, AuthUser } from "../../../types";
import { AuthService } from "./auth.service";

type RequiredCapability = Exclude<AppCapability, "GUEST">;

const REQUIRED_CAPABILITIES_KEY = "staynex:required-capabilities";

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

export const RequireAnyCapability = (...capabilities: RequiredCapability[]) =>
  SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) throw new UnauthorizedException("Sign in required");
    return req.user;
  },
);

function cookieHeader(req: AuthenticatedRequest): string | undefined {
  const value = req.headers.cookie;
  return Array.isArray(value) ? value.join("; ") : value;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.auth.resolve(cookieHeader(req));
    if (!user) throw new UnauthorizedException("Sign in required");
    req.user = user;
    return true;
  }
}

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredCapability[]>(
      REQUIRED_CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user ?? (await this.auth.resolve(cookieHeader(req)));
    if (!user) throw new UnauthorizedException("Sign in required");

    const allowed = required.some((capability) =>
      user.capabilities.includes(capability),
    );
    if (!allowed) throw new ForbiddenException("Insufficient permissions");

    req.user = user;
    return true;
  }
}
