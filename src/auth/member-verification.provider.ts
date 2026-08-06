import {
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SendMemberVerificationCodeInput {
  phone: string;
  code: string;
  expiresInMinutes: number;
}

@Injectable()
export class MemberVerificationProvider {
  constructor(private readonly configService: ConfigService) {}

  get providerName() {
    return this.configService.get<string>("MEMBER_AUTH_PROVIDER")?.trim() ||
      "development";
  }

  async sendCode(input: SendMemberVerificationCodeInput) {
    if (this.providerName === "development") {
      return;
    }

    const url = this.requiredConfig("MEMBER_AUTH_WEBHOOK_URL");
    const token = this.requiredConfig("MEMBER_AUTH_WEBHOOK_TOKEN");

    try {
      const response = await fetch(url, {
        body: JSON.stringify({
          phone: input.phone,
          code: input.code,
          expiresInMinutes: input.expiresInMinutes,
          purpose: "member_login"
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        signal: AbortSignal.timeout(5_000)
      });

      if (!response.ok) {
        throw new Error(`Verification provider returned ${response.status}`);
      }
    } catch {
      throw new ServiceUnavailableException(
        "验证码发送失败，请稍后重试。"
      );
    }
  }

  private requiredConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new ServiceUnavailableException(
        "验证码服务暂时不可用。"
      );
    }

    return value;
  }
}
