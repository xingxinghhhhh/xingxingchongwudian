export type PaymentProvider = "mock_wechat" | "mock_alipay";
export type LegacyPaymentProvider = "wechat" | "alipay";
export type PaymentIntentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export type PaymentFailureCode =
  | "INSUFFICIENT_BALANCE"
  | "PAYMENT_DECLINED"
  | "PROVIDER_UNAVAILABLE"
  | "USER_CANCELLED_PAYMENT"
  | "UNKNOWN_PROVIDER_ERROR";

export interface CreateProviderPaymentInput {
  paymentIntentId: string;
  orderId: string;
  amount: number;
}

export interface ProviderPaymentCreation {
  status: Extract<PaymentIntentStatus, "created" | "pending">;
  payUrl: string;
}

export interface ConfirmProviderPaymentInput {
  paymentIntentId: string;
  orderId: string;
  amount: number;
  result: "success" | "failed";
  providerTradeNo?: string;
}

export type ProviderPaymentConfirmation =
  | {
      providerTradeNo?: string;
      status: "success";
    }
  | {
      providerTradeNo?: string;
      status: "failed";
      failureCode: PaymentFailureCode;
      failureMessage: string;
    };

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentCreation>;
  confirmPayment(
    input: ConfirmProviderPaymentInput
  ): Promise<ProviderPaymentConfirmation>;
}

export class MockWechatPaymentAdapter implements PaymentProviderAdapter {
  readonly provider = "mock_wechat" as const;

  async createPayment(input: CreateProviderPaymentInput) {
    return {
      status: "pending" as const,
      payUrl: `/mock-pay/wechat/${input.orderId}`
    };
  }

  async confirmPayment(input: ConfirmProviderPaymentInput) {
    if (input.result === "failed") {
      return {
        status: "failed" as const,
        failureCode: "USER_CANCELLED_PAYMENT" as const,
        failureMessage: "The member cancelled this mock WeChat payment attempt."
      };
    }

    return {
      status: "success" as const,
      providerTradeNo:
        input.providerTradeNo ?? `wx_${input.paymentIntentId.toLowerCase()}`
    };
  }
}

export class MockAlipayPaymentAdapter implements PaymentProviderAdapter {
  readonly provider = "mock_alipay" as const;

  async createPayment(input: CreateProviderPaymentInput) {
    return {
      status: "pending" as const,
      payUrl: `/mock-pay/alipay/${input.orderId}`
    };
  }

  async confirmPayment(input: ConfirmProviderPaymentInput) {
    if (input.result === "failed") {
      return {
        status: "failed" as const,
        failureCode: "INSUFFICIENT_BALANCE" as const,
        failureMessage: "The mock Alipay provider reported insufficient balance."
      };
    }

    return {
      status: "success" as const,
      providerTradeNo:
        input.providerTradeNo ?? `ali_${input.paymentIntentId.toLowerCase()}`
    };
  }
}

export function resolveLegacyProvider(provider: LegacyPaymentProvider): PaymentProvider {
  return provider === "wechat" ? "mock_wechat" : "mock_alipay";
}

export function toLegacyProvider(provider: PaymentProvider): LegacyPaymentProvider {
  return provider === "mock_wechat" ? "wechat" : "alipay";
}
