import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma } from "../../../db";
import type {
  PayoutBankDirectoryView,
  PayoutBankOption,
  ResolvedPayoutAccount,
} from "../../../types";
import { PaystackService, type PaystackBank } from "./paystack.service";

const PROVIDER = "paystack" as const;
const COUNTRY = "NG";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Paystack-authoritative bank directory with a durable database fallback.
 * Stable provider lookups are cached to protect rate limits; account names are
 * always resolved live by Paystack and are never accepted from the browser.
 */
@Injectable()
export class BankDirectoryService {
  private readonly logger = new Logger(BankDirectoryService.name);
  private refreshInFlight: Promise<PayoutBankDirectoryView> | null = null;

  constructor(private readonly paystack: PaystackService) {}

  async list(): Promise<PayoutBankDirectoryView> {
    let cached: Awaited<ReturnType<BankDirectoryService["cachedBanks"]>> = [];
    try {
      cached = await this.cachedBanks();
    } catch (error) {
      this.logger.warn(
        `Bank directory cache read failed; trying Paystack: ${this.errorMessage(error)}`,
      );
    }

    // Every row in a successful sync has the same timestamp. Taking the oldest
    // makes a partially populated legacy cache stale instead of accidentally
    // treating it as a complete, fresh provider snapshot.
    const refreshedAt = cached.reduce<Date | null>(
      (oldest, row) =>
        !oldest || row.lastSyncedAt < oldest ? row.lastSyncedAt : oldest,
      null,
    );
    if (refreshedAt && Date.now() - refreshedAt.getTime() < CACHE_TTL_MS) {
      return this.toView(cached, "cache", refreshedAt);
    }

    try {
      return await this.refreshProviderBanks();
    } catch (error) {
      if (cached.length > 0 && refreshedAt) {
        this.logger.warn(
          `Paystack bank directory refresh failed; serving stale cache: ${this.errorMessage(error)}`,
        );
        return this.toView(cached, "cache", refreshedAt);
      }
      throw error;
    }
  }

  async resolve(
    bankCode: string,
    accountNumber: string,
  ): Promise<ResolvedPayoutAccount> {
    const directory = await this.list();
    const bank = directory.banks.find((entry) => entry.code === bankCode);
    if (!bank) throw new BadRequestException("Select a supported bank");

    const resolved = await this.paystack.resolveBankAccount(
      accountNumber,
      bankCode,
    );
    if (resolved.accountNumber !== accountNumber) {
      throw new BadRequestException(
        "The payment provider returned a different account number",
      );
    }
    return {
      bankCode,
      bankName: bank.name,
      accountName: resolved.accountName,
      accountNumberLast4: accountNumber.slice(-4),
      provider: PROVIDER,
    };
  }

  private cachedBanks() {
    return prisma.bankDirectoryEntry.findMany({
      where: { provider: PROVIDER, country: COUNTRY, active: true },
      orderBy: { name: "asc" },
    });
  }

  private async storeProviderBanks(
    banks: PaystackBank[],
    syncedAt: Date,
  ): Promise<void> {
    // This table is an unreferenced cache snapshot, not financial history.
    // Replacing it atomically avoids hundreds of row-by-row upserts while still
    // guaranteeing readers see either the previous complete list or the new one.
    await prisma.$transaction([
      prisma.bankDirectoryEntry.deleteMany({
        where: { provider: PROVIDER, country: COUNTRY },
      }),
      prisma.bankDirectoryEntry.createMany({
        data: banks.map((bank) => ({
          provider: PROVIDER,
          country: COUNTRY,
          currency: bank.currency,
          code: bank.code,
          name: bank.name,
          type: bank.type,
          active: true,
          lastSyncedAt: syncedAt,
        })),
      }),
    ]);
  }

  /**
   * Collapse concurrent cold-cache requests into one provider refresh. Cache
   * persistence is best-effort: Paystack remains authoritative, so a valid live
   * response must not become a 500 merely because the fallback cache is down.
   */
  private refreshProviderBanks(): Promise<PayoutBankDirectoryView> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const refresh = this.fetchAndStoreProviderBanks().finally(() => {
      if (this.refreshInFlight === refresh) this.refreshInFlight = null;
    });
    this.refreshInFlight = refresh;
    return refresh;
  }

  private async fetchAndStoreProviderBanks(): Promise<PayoutBankDirectoryView> {
    const providerBanks = await this.paystack.listBanks();
    if (providerBanks.length === 0) {
      throw new ServiceUnavailableException(
        "The payment provider returned no banks",
      );
    }

    const syncedAt = new Date();
    try {
      await this.storeProviderBanks(providerBanks, syncedAt);
    } catch (error) {
      this.logger.warn(
        `Paystack bank directory cache write failed; serving live data: ${this.errorMessage(error)}`,
      );
    }

    return {
      banks: providerBanks.map((bank) => this.toOption(bank)),
      source: "paystack",
      refreshedAt: syncedAt.toISOString(),
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "unknown error";
  }

  private toView(
    rows: Array<{ code: string; name: string }>,
    source: "cache",
    refreshedAt: Date,
  ): PayoutBankDirectoryView {
    return {
      banks: rows.map((bank) => ({
        code: bank.code,
        name: bank.name,
        provider: PROVIDER,
      })),
      source,
      refreshedAt: refreshedAt.toISOString(),
    };
  }

  private toOption(bank: PaystackBank): PayoutBankOption {
    return { code: bank.code, name: bank.name, provider: PROVIDER };
  }
}
