import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { MemberVerificationProvider } from "./member-verification.provider";

function createConfigService(
  values: Record<string, string | undefined> = {}
): ConfigService {
  return {
    get: jest.fn((key: string) => values[key])
  } as unknown as ConfigService;
}

function createProvider() {
  return {
    providerName: "development",
    sendCode: jest.fn().mockResolvedValue(undefined)
  } as unknown as MemberVerificationProvider;
}

async function verifyMember(
  service: AuthService,
  name: string,
  phone: string
) {
  const challenge = await service.requestVerification({ name, phone });
  const developmentCode = challenge.developmentCode;

  if (!developmentCode) {
    throw new Error("Expected a development verification code");
  }

  return service.login({
    challengeId: challenge.challengeId,
    code: developmentCode
  });
}

describe("AuthService", () => {
  it("requires a one-time verification code before creating a memory session", async () => {
    const provider = createProvider();
    const service = new AuthService(
      createConfigService(),
      {} as never,
      provider
    );
    const challenge = await service.requestVerification({
      name: " Memory Owner ",
      phone: " 13600136001 "
    });

    expect(challenge).toMatchObject({
      challengeId: expect.stringMatching(/^verify_/),
      developmentCode: expect.stringMatching(/^\d{6}$/),
      retryAfterSeconds: 60
    });
    expect(provider.sendCode).toHaveBeenCalledWith({
      phone: "13600136001",
      code: challenge.developmentCode,
      expiresInMinutes: 5
    });

    const login = await service.login({
      challengeId: challenge.challengeId,
      code: challenge.developmentCode!
    });

    expect(login.sessionToken).toMatch(/^member_/);
    expect(login.expiresAt).toEqual(expect.any(String));
    await expect(service.getSession(login.sessionToken)).resolves.toMatchObject({
      name: "Memory Owner",
      phone: "13600136001"
    });
    await expect(
      service.login({
        challengeId: challenge.challengeId,
        code: challenge.developmentCode!
      })
    ).rejects.toThrow("验证码无效或已过期");
    await expect(service.getVerificationMetrics()).resolves.toMatchObject({
      issuedCount: 1,
      successCount: 1,
      activeCount: 0,
      failedAttemptCount: 0,
      successRate: 1
    });
  });

  it("rejects wrong codes and rate limits an unconsumed phone challenge", async () => {
    const service = new AuthService(
      createConfigService(),
      {} as never,
      createProvider()
    );
    const challenge = await service.requestVerification({
      name: "Protected Owner",
      phone: "13600136003"
    });

    await expect(
      service.login({
        challengeId: challenge.challengeId,
        code: "000000" === challenge.developmentCode ? "000001" : "000000"
      })
    ).rejects.toThrow("验证码无效或已过期");

    await expect(
      service.requestVerification({
        name: "Protected Owner",
        phone: "13600136003"
      })
    ).rejects.toMatchObject({ status: 429 });
    await expect(service.getVerificationMetrics()).resolves.toMatchObject({
      issuedCount: 1,
      successCount: 0,
      activeCount: 1,
      failedAttemptCount: 1,
      successRate: 0
    });
  });

  it("persists hashed challenges and member sessions when a database is configured", async () => {
    const challenges = new Map<string, Record<string, any>>();
    const prisma = {
      memberAuthChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, any> }) => {
          const saved = {
            ...data,
            attempts: 0,
            consumedAt: null,
            createdAt: new Date()
          };
          challenges.set(String(data.id), saved);
          return saved;
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          challenges.get(where.id) ?? null
        ),
        update: jest.fn(),
        updateMany: jest.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
            const challenge = challenges.get(where.id);
            if (!challenge || challenge.consumedAt) {
              return { count: 0 };
            }
            challenge.consumedAt = data.consumedAt;
            return { count: 1 };
          }
        ),
        delete: jest.fn()
      },
      memberSession: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          token: "member_db_001",
          name: "Database Owner",
          phone: "13600136002",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          lastSeenAt: new Date("2026-05-26T00:00:00.000Z"),
          createdAt: new Date("2026-05-26T00:00:00.000Z")
        }),
        update: jest.fn().mockResolvedValue({})
      }
    };
    const service = new AuthService(
      createConfigService({
        DATABASE_URL: "mysql://user:pass@localhost:3306/shop"
      }),
      prisma as never,
      createProvider()
    );

    const login = await verifyMember(
      service,
      "Database Owner",
      "13600136002"
    );

    expect(prisma.memberAuthChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^verify_/),
        phone: "13600136002",
        name: "Database Owner",
        codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        provider: "development",
        expiresAt: expect.any(Date)
      })
    });
    expect(prisma.memberSession.create).toHaveBeenCalledWith({
      data: {
        token: login.sessionToken,
        name: "Database Owner",
        phone: "13600136002",
        expiresAt: expect.any(Date)
      }
    });

    await expect(service.getSession("member_db_001")).resolves.toMatchObject({
      name: "Database Owner",
      phone: "13600136002"
    });
    expect(prisma.memberSession.update).toHaveBeenCalledWith({
      where: { token: "member_db_001" },
      data: { lastSeenAt: expect.any(Date) }
    });
  });

  it("revokes database sessions on logout and rejects expired sessions", async () => {
    const session = {
      token: "member_db_002",
      name: "Database Owner",
      phone: "13600136002",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null as Date | null,
      lastSeenAt: new Date()
    };
    const prisma = {
      memberSession: {
        findUnique: jest.fn(async () => session),
        update: jest.fn(async ({ data }: { data: { revokedAt?: Date } }) => {
          if (data.revokedAt) {
            session.revokedAt = data.revokedAt;
          }
          return session;
        })
      }
    };
    const service = new AuthService(
      createConfigService({ DATABASE_URL: "file:./dev.db" }),
      prisma as never,
      createProvider()
    );

    await expect(service.logout(session.token)).resolves.toEqual({
      success: true
    });
    await expect(service.getSession(session.token)).rejects.toThrow(
      "Invalid member session"
    );

    session.revokedAt = null;
    session.expiresAt = new Date(Date.now() - 1_000);
    await expect(service.getSession(session.token)).rejects.toThrow(
      "Invalid member session"
    );
  });

  it("deletes memory sessions on logout", async () => {
    const service = new AuthService(
      createConfigService(),
      {} as never,
      createProvider()
    );
    const login = await verifyMember(
      service,
      "Memory Owner",
      "13600136001"
    );

    await service.logout(login.sessionToken);

    await expect(service.getSession(login.sessionToken)).rejects.toThrow(
      "Invalid member session"
    );
  });
});
