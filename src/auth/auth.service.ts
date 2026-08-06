import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual
} from "node:crypto";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { LoginMemberDto } from "./dto/login-member.dto";
import { RequestMemberVerificationDto } from "./dto/request-member-verification.dto";
import { MemberVerificationProvider } from "./member-verification.provider";

interface MemberSession {
  phone: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

interface MemberAuthChallenge {
  id: string;
  phone: string;
  name: string;
  codeHash: string;
  provider: string;
  attempts: number;
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
}

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, MemberSession>();
  private readonly challenges = new Map<string, MemberAuthChallenge>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly verificationProvider: MemberVerificationProvider
  ) {}

  async requestVerification(dto: RequestMemberVerificationDto) {
    const input = this.normalizeVerificationInput(dto);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.getVerificationTtlMinutes() * 60_000
    );
    const challengeId = `verify_${randomBytes(18).toString("base64url")}`;
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const codeHash = this.hashVerificationCode(challengeId, input.phone, code);

    await this.assertVerificationCanBeSent(input.phone, now);

    if (this.isDatabaseConfigured()) {
      await this.prisma.memberAuthChallenge.create({
        data: {
          id: challengeId,
          phone: input.phone,
          name: input.name,
          codeHash,
          provider: this.verificationProvider.providerName,
          expiresAt
        }
      });
    } else {
      this.challenges.set(challengeId, {
        id: challengeId,
        phone: input.phone,
        name: input.name,
        codeHash,
        provider: this.verificationProvider.providerName,
        attempts: 0,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString()
      });
    }

    try {
      await this.verificationProvider.sendCode({
        phone: input.phone,
        code,
        expiresInMinutes: this.getVerificationTtlMinutes()
      });
    } catch (error) {
      await this.removeChallenge(challengeId);
      throw error;
    }

    return {
      challengeId,
      expiresAt: expiresAt.toISOString(),
      retryAfterSeconds: this.getVerificationCooldownSeconds(),
      ...(this.canExposeDevelopmentCode() ? { developmentCode: code } : {})
    };
  }

  async login(dto: LoginMemberDto) {
    const input = {
      challengeId: dto.challengeId.trim(),
      code: dto.code.trim()
    };

    if (this.isDatabaseConfigured()) {
      const challenge = await this.prisma.memberAuthChallenge.findUnique({
        where: { id: input.challengeId }
      });

      this.assertChallengeUsable(challenge);

      if (
        !this.verifyCode(
          challenge.codeHash,
          challenge.id,
          challenge.phone,
          input.code
        )
      ) {
        await this.prisma.memberAuthChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } }
        });
        throw new UnauthorizedException("验证码无效或已过期");
      }

      const consumed = await this.prisma.memberAuthChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: this.getVerificationMaxAttempts() }
        },
        data: { consumedAt: new Date() }
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException("验证码无效或已过期");
      }

      return this.createSession({
        phone: challenge.phone,
        name: challenge.name
      });
    }

    const challenge = this.challenges.get(input.challengeId);
    this.assertChallengeUsable(challenge);

    if (
      !this.verifyCode(
        challenge.codeHash,
        challenge.id,
        challenge.phone,
        input.code
      )
    ) {
      challenge.attempts += 1;
      this.challenges.set(challenge.id, challenge);
      throw new UnauthorizedException("验证码无效或已过期");
    }

    challenge.consumedAt = new Date().toISOString();
    this.challenges.set(challenge.id, challenge);

    return this.createSession({
      phone: challenge.phone,
      name: challenge.name
    });
  }

  private async createSession(member: { phone: string; name: string }) {
    const sessionToken = this.createSessionToken();
    const expiresAt = new Date(
      Date.now() + this.getSessionTtlDays() * 24 * 60 * 60 * 1_000
    );

    if (this.isDatabaseConfigured()) {
      await this.prisma.memberSession.create({
        data: {
          token: sessionToken,
          phone: member.phone,
          name: member.name,
          expiresAt
        }
      });

      return {
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        member
      };
    }

    this.sessions.set(sessionToken, {
      ...member,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    });

    return {
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      member
    };
  }

  async getVerificationMetrics(windowHours = 24) {
    const now = new Date();
    const startedAt = new Date(now.getTime() - windowHours * 60 * 60_000);
    const challenges = this.isDatabaseConfigured()
      ? await this.prisma.memberAuthChallenge.findMany({
          where: { createdAt: { gte: startedAt } },
          select: {
            attempts: true,
            consumedAt: true,
            expiresAt: true
          }
        })
      : Array.from(this.challenges.values())
          .filter(
            (challenge) =>
              new Date(challenge.createdAt).getTime() >= startedAt.getTime()
          )
          .map((challenge) => ({
            attempts: challenge.attempts,
            consumedAt: challenge.consumedAt,
            expiresAt: challenge.expiresAt
          }));
    const successCount = challenges.filter(
      (challenge) => Boolean(challenge.consumedAt)
    ).length;
    const lockedCount = challenges.filter(
      (challenge) =>
        !challenge.consumedAt &&
        challenge.attempts >= this.getVerificationMaxAttempts()
    ).length;
    const expiredCount = challenges.filter(
      (challenge) =>
        !challenge.consumedAt &&
        challenge.attempts < this.getVerificationMaxAttempts() &&
        new Date(challenge.expiresAt).getTime() <= now.getTime()
    ).length;
    const activeCount = challenges.filter(
      (challenge) =>
        !challenge.consumedAt &&
        challenge.attempts < this.getVerificationMaxAttempts() &&
        new Date(challenge.expiresAt).getTime() > now.getTime()
    ).length;
    const issuedCount = challenges.length;

    return {
      windowHours,
      issuedCount,
      successCount,
      activeCount,
      expiredCount,
      lockedCount,
      failedAttemptCount: challenges.reduce(
        (total, challenge) => total + challenge.attempts,
        0
      ),
      successRate:
        issuedCount === 0
          ? 0
          : Number((successCount / issuedCount).toFixed(4))
    };
  }

  async getSession(sessionToken?: string) {
    if (!sessionToken) {
      throw new UnauthorizedException("Invalid member session");
    }

    if (this.isDatabaseConfigured()) {
      const session = await this.prisma.memberSession.findUnique({
        where: { token: sessionToken }
      });

      if (
        !session ||
        session.revokedAt ||
        !session.expiresAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException("Invalid member session");
      }

      if (Date.now() - session.lastSeenAt.getTime() >= 60_000) {
        await this.prisma.memberSession.update({
          where: { token: sessionToken },
          data: { lastSeenAt: new Date() }
        });
      }

      return session;
    }

    const session = this.sessions.get(sessionToken);

    if (
      !session ||
      session.revokedAt ||
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      throw new UnauthorizedException("Invalid member session");
    }

    return session;
  }

  async logout(sessionToken?: string) {
    if (!sessionToken) {
      throw new UnauthorizedException("Invalid member session");
    }

    if (this.isDatabaseConfigured()) {
      const session = await this.prisma.memberSession.findUnique({
        where: { token: sessionToken }
      });

      if (session && !session.revokedAt) {
        await this.prisma.memberSession.update({
          where: { token: sessionToken },
          data: { revokedAt: new Date() }
        });
      }

      return { success: true };
    }

    this.sessions.delete(sessionToken);
    return { success: true };
  }

  private normalizeVerificationInput(
    dto: RequestMemberVerificationDto
  ): RequestMemberVerificationDto {
    const name = dto.name.trim();
    const phone = dto.phone.trim();

    if (!name) {
      throw new BadRequestException("Member name cannot be blank");
    }

    return {
      ...dto,
      name,
      phone
    };
  }

  private createSessionToken() {
    return `member_${randomBytes(32).toString("base64url")}`;
  }

  private getSessionTtlDays() {
    return Number(
      this.configService.get<string>("MEMBER_SESSION_TTL_DAYS") ?? "30"
    );
  }

  private getVerificationTtlMinutes() {
    return Number(
      this.configService.get<string>("MEMBER_AUTH_CODE_TTL_MINUTES") ?? "5"
    );
  }

  private getVerificationCooldownSeconds() {
    return Number(
      this.configService.get<string>("MEMBER_AUTH_SEND_COOLDOWN_SECONDS") ?? "60"
    );
  }

  private getVerificationMaxAttempts() {
    return 5;
  }

  private async assertVerificationCanBeSent(phone: string, now: Date) {
    const cooldownStartedAt = new Date(
      now.getTime() - this.getVerificationCooldownSeconds() * 1_000
    );

    if (this.isDatabaseConfigured()) {
      const recent = await this.prisma.memberAuthChallenge.findFirst({
        where: {
          phone,
          consumedAt: null,
          createdAt: { gt: cooldownStartedAt }
        },
        orderBy: { createdAt: "desc" }
      });

      if (recent) {
        throw this.verificationCooldownError();
      }

      return;
    }

    const hasRecent = Array.from(this.challenges.values()).some(
      (challenge) =>
        challenge.phone === phone &&
        !challenge.consumedAt &&
        new Date(challenge.createdAt).getTime() > cooldownStartedAt.getTime()
    );

    if (hasRecent) {
      throw this.verificationCooldownError();
    }
  }

  private verificationCooldownError() {
    return new HttpException(
      "验证码发送过于频繁，请稍后再试。",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private assertChallengeUsable(
    challenge:
      | {
          attempts: number;
          consumedAt?: Date | string | null;
          expiresAt: Date | string;
        }
      | null
      | undefined
  ): asserts challenge is NonNullable<typeof challenge> {
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.attempts >= this.getVerificationMaxAttempts() ||
      new Date(challenge.expiresAt).getTime() <= Date.now()
    ) {
      throw new UnauthorizedException("验证码无效或已过期");
    }
  }

  private hashVerificationCode(
    challengeId: string,
    phone: string,
    code: string
  ) {
    return createHmac("sha256", this.getVerificationCodeSecret())
      .update(`${challengeId}:${phone}:${code}`)
      .digest("hex");
  }

  private verifyCode(
    expectedHash: string,
    challengeId: string,
    phone: string,
    code: string
  ) {
    const actual = Buffer.from(
      this.hashVerificationCode(challengeId, phone, code),
      "hex"
    );
    const expected = Buffer.from(expectedHash, "hex");

    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  }

  private getVerificationCodeSecret() {
    return (
      this.configService.get<string>("MEMBER_AUTH_CODE_SECRET")?.trim() ||
      "development-member-auth-code-secret"
    );
  }

  private canExposeDevelopmentCode() {
    const nodeEnv =
      this.configService.get<string>("NODE_ENV") ?? process.env.NODE_ENV;

    return (
      nodeEnv !== "production" &&
      this.verificationProvider.providerName === "development"
    );
  }

  private async removeChallenge(challengeId: string) {
    if (this.isDatabaseConfigured()) {
      await this.prisma.memberAuthChallenge.delete({
        where: { id: challengeId }
      });
      return;
    }

    this.challenges.delete(challengeId);
  }

  private isDatabaseConfigured() {
    return (
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"))
    );
  }
}
