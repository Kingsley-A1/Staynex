import {
  BadRequestException,
  Injectable,
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
  constructor(private readonly paystack: PaystackService) {}

  async list(): Promise<PayoutBankDirectoryView> {
    const cached = await this.cachedBanks();
    const refreshedAt = cached[0]?.lastSyncedAt ?? null;
    if (refreshedAt && Date.now() - refreshedAt.getTime() < CACHE_TTL_MS) {
      return this.toView(cached, "cache", refreshedAt);
    }

    try {
      const providerBanks = await this.paystack.listBanks();
      if (providerBanks.length === 0) {
        throw new ServiceUnavailableException(
          "The payment provider returned no banks",
        );
      }
      const syncedAt = new Date();
      await this.storeProviderBanks(providerBanks, syncedAt);
      return {
        banks: providerBanks.map((bank) => this.toOption(bank)),
        source: "paystack",
        refreshedAt: syncedAt.toISOString(),
      };
    } catch (error) {
      if (cached.length > 0 && refreshedAt) {
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
    const activeCodes = banks.map((bank) => bank.code);
    await prisma.$transaction(async (tx) => {
      await tx.bankDirectoryEntry.updateMany({
        where: {
          provider: PROVIDER,
          country: COUNTRY,
          code: { notIn: activeCodes },
        },
        data: { active: false, lastSyncedAt: syncedAt },
      });
      for (const bank of banks) {
        await tx.bankDirectoryEntry.upsert({
          where: {
            provider_country_code: {
              provider: PROVIDER,
              country: COUNTRY,
              code: bank.code,
            },
          },
          update: {
            name: bank.name,
            currency: bank.currency,
            type: bank.type,
            active: true,
            lastSyncedAt: syncedAt,
          },
          create: {
            provider: PROVIDER,
            country: COUNTRY,
            currency: bank.currency,
            code: bank.code,
            name: bank.name,
            type: bank.type,
            active: true,
            lastSyncedAt: syncedAt,
          },
        });
      }
    });
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
