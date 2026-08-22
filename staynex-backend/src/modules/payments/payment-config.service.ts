import { Injectable } from "@nestjs/common";
import { loadEnv, type Env } from "../../../config";
import type { PaymentMode, ProviderName } from "./payment-provider.port";

export interface ProviderRuntimeConfig {
  configured: boolean;
  secretKey: string | null;
  publicKey: string | null;
  merchantId: string | null;
  baseUrl: string | null;
}

export interface PaymentRuntimeConfig {
  enabled: boolean;
  mode: PaymentMode;
  isProduction: boolean;
  defaultProvider: ProviderName;
  opayRolloutPercent: number;
  appUrl: string;
  providers: Record<ProviderName, ProviderRuntimeConfig>;
  providersByMode: Record<
    PaymentMode,
    Record<ProviderName, ProviderRuntimeConfig>
  >;
}

function paystackConfig(
  mode: PaymentMode,
  secretKey: string | undefined,
  publicKey: string | undefined,
): ProviderRuntimeConfig {
  if (secretKey) {
    const expectedPrefix = mode === "TEST" ? "sk_test_" : "sk_live_";
    if (!secretKey.startsWith(expectedPrefix)) {
      const variable =
        mode === "TEST"
          ? "PAYSTACK_TEST_SECRET_KEY"
          : "PAYSTACK_LIVE_SECRET_KEY";
      throw new Error(`${variable} must be a ${mode.toLowerCase()} credential`);
    }
  }
  if (publicKey) {
    const expectedPrefix = mode === "TEST" ? "pk_test_" : "pk_live_";
    if (!publicKey.startsWith(expectedPrefix)) {
      const variable =
        mode === "TEST"
          ? "PAYSTACK_TEST_PUBLIC_KEY"
          : "PAYSTACK_LIVE_PUBLIC_KEY";
      throw new Error(`${variable} must be a ${mode.toLowerCase()} credential`);
    }
  }
  return {
    configured: Boolean(secretKey),
    secretKey: secretKey ?? null,
    publicKey: publicKey ?? null,
    merchantId: null,
    baseUrl: "https://api.paystack.co",
  };
}

function opayConfig(
  mode: PaymentMode,
  enabled: boolean,
  values: {
    merchantId?: string;
    publicKey?: string;
    secretKey?: string;
    baseUrl?: string;
  },
): ProviderRuntimeConfig {
  const present = [
    values.merchantId,
    values.publicKey,
    values.secretKey,
    values.baseUrl,
  ].filter(Boolean).length;
  if (enabled && present !== 4) {
    throw new Error(
      `OPay ${mode} configuration is incomplete; merchant ID, public key, secret key, and base URL are required`,
    );
  }
  return {
    configured: enabled && present === 4,
    secretKey: values.secretKey ?? null,
    publicKey: values.publicKey ?? null,
    merchantId: values.merchantId ?? null,
    baseUrl: values.baseUrl?.replace(/\/+$/, "") ?? null,
  };
}

export function resolvePaymentRuntime(env: Env): PaymentRuntimeConfig {
  const mode: PaymentMode = env.PAYMENT_ENABLED ? "LIVE" : "TEST";
  const testPaystackSecret =
    env.PAYSTACK_TEST_SECRET_KEY ??
    (env.NODE_ENV !== "production" ? env.PAYSTACK_SECRET_KEY : undefined);
  const testPaystackPublic =
    env.PAYSTACK_TEST_PUBLIC_KEY ??
    (env.NODE_ENV !== "production" ? env.PAYSTACK_PUBLIC_KEY : undefined);

  const providersByMode = {
    TEST: {
      paystack: paystackConfig(
        "TEST",
        testPaystackSecret,
        testPaystackPublic,
      ),
      opay: opayConfig("TEST", env.OPAY_ENABLED, {
        merchantId: env.OPAY_TEST_MERCHANT_ID,
        publicKey: env.OPAY_TEST_PUBLIC_KEY,
        secretKey: env.OPAY_TEST_SECRET_KEY,
        baseUrl: env.OPAY_TEST_BASE_URL,
      }),
    },
    LIVE: {
      paystack: paystackConfig(
        "LIVE",
        env.PAYSTACK_LIVE_SECRET_KEY,
        env.PAYSTACK_LIVE_PUBLIC_KEY,
      ),
      opay: opayConfig("LIVE", env.OPAY_ENABLED && env.PAYMENT_ENABLED, {
        merchantId: env.OPAY_LIVE_MERCHANT_ID,
        publicKey: env.OPAY_LIVE_PUBLIC_KEY,
        secretKey: env.OPAY_LIVE_SECRET_KEY,
        baseUrl: env.OPAY_LIVE_BASE_URL,
      }),
    },
  } satisfies Record<
    PaymentMode,
    Record<ProviderName, ProviderRuntimeConfig>
  >;

  const providers = providersByMode[mode];
  if (
    env.NODE_ENV === "production" &&
    !providers[env.PAYMENT_DEFAULT_PROVIDER].configured
  ) {
    throw new Error(
      `${env.PAYMENT_DEFAULT_PROVIDER} ${mode} payment configuration is required in production`,
    );
  }
  if (env.PAYMENT_OPAY_ROLLOUT_PERCENT > 0 && !providers.opay.configured) {
    throw new Error(
      "PAYMENT_OPAY_ROLLOUT_PERCENT requires complete OPay configuration for the selected mode",
    );
  }

  return {
    enabled: env.PAYMENT_ENABLED,
    mode,
    isProduction: env.NODE_ENV === "production",
    defaultProvider: env.PAYMENT_DEFAULT_PROVIDER,
    opayRolloutPercent: env.PAYMENT_OPAY_ROLLOUT_PERCENT,
    appUrl: env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    providers,
    providersByMode,
  };
}

@Injectable()
export class PaymentConfigService {
  private readonly runtime = resolvePaymentRuntime(loadEnv());

  current(): PaymentRuntimeConfig {
    return this.runtime;
  }

  provider(
    name: ProviderName,
    mode: PaymentMode = this.runtime.mode,
  ): ProviderRuntimeConfig {
    return this.runtime.providersByMode[mode][name];
  }
}
