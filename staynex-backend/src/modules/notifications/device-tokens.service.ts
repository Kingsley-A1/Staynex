import { Injectable } from "@nestjs/common";
import type { DevicePlatform } from "@prisma/client";
import { prisma } from "../../../db";

/**
 * FCM device-token registry. A token is unique per device+browser profile;
 * upserting by token (re-assigning the owner) handles shared devices and
 * re-logins cleanly. Dead tokens reported by FCM are pruned immediately.
 */
@Injectable()
export class DeviceTokensService {
  async register(userId: string, token: string, platform: DevicePlatform): Promise<{ ok: true }> {
    await prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  /** Remove a token (logout / opt-out). Scoped to the caller's own tokens. */
  async remove(userId: string, token: string): Promise<{ ok: true }> {
    await prisma.deviceToken.deleteMany({ where: { token, userId } });
    return { ok: true };
  }

  async tokensForUser(userId: string): Promise<string[]> {
    const rows = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  async tokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  /** Prune tokens FCM reported as UNREGISTERED. */
  async pruneDead(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await prisma.deviceToken.deleteMany({ where: { token: { in: tokens } } });
  }
}
