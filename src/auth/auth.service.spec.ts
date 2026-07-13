import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";

function createConfigService(databaseUrl?: string): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === "DATABASE_URL" ? databaseUrl : undefined
    )
  } as unknown as ConfigService;
}

describe("AuthService", () => {
  it("keeps member sessions in memory when no database is configured", async () => {
    const service = new AuthService(createConfigService(), {} as never);

    const login = await service.login({
      name: "Memory Owner",
      phone: "13600136001"
    });

    expect(login.sessionToken).toMatch(/^member_/);
    await expect(service.getSession(login.sessionToken)).resolves.toMatchObject({
      name: "Memory Owner",
      phone: "13600136001"
    });
  });

  it("persists member sessions when a database is configured", async () => {
    const prisma = {
      memberSession: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          token: "member_db_001",
          name: "Database Owner",
          phone: "13600136002",
          createdAt: new Date("2026-05-26T00:00:00.000Z")
        }),
        update: jest.fn().mockResolvedValue({})
      }
    };
    const service = new AuthService(
      createConfigService("mysql://user:pass@localhost:3306/shop"),
      prisma as never
    );

    const login = await service.login({
      name: "Database Owner",
      phone: "13600136002"
    });

    expect(login).toMatchObject({
      member: {
        name: "Database Owner",
        phone: "13600136002"
      }
    });
    expect(prisma.memberSession.create).toHaveBeenCalledWith({
      data: {
        token: login.sessionToken,
        name: "Database Owner",
        phone: "13600136002"
      }
    });

    await expect(service.getSession("member_db_001")).resolves.toMatchObject({
      name: "Database Owner",
      phone: "13600136002"
    });
    expect(prisma.memberSession.findUnique).toHaveBeenCalledWith({
      where: { token: "member_db_001" }
    });
    expect(prisma.memberSession.update).toHaveBeenCalledWith({
      where: { token: "member_db_001" },
      data: { lastSeenAt: expect.any(Date) }
    });
  });
});
