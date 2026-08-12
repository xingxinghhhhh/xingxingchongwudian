import { ConfigService } from "@nestjs/config";
import { AdminAuthService } from "./admin-auth.service";
import { ADMIN_OWNER_PERMISSIONS } from "./admin-owner-bootstrap";

function createStaffService() {
  return {
    recordOperation: jest.fn().mockResolvedValue(undefined)
  };
}

function createPersistentPrisma() {
  let account: Record<string, unknown> | null = null;
  const sessions = new Map<string, Record<string, unknown>>();
  let sessionSequence = 0;

  const prisma = {
    adminStaffAccount: {
      findFirst: jest.fn(async ({ where }: {
        where: { role?: string; status?: string };
      }) => {
        if (!account) {
          return null;
        }
        if (where.role && account.role !== where.role) {
          return null;
        }
        if (where.status && account.status !== where.status) {
          return null;
        }
        return account;
      }),
      upsert: jest.fn(async ({ create, update }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const now = new Date();
        account = account
          ? { ...account, ...update, updatedAt: now }
          : {
              ...create,
              id: "staff_owner_id",
              lastLoginAt: null,
              createdAt: now,
              updatedAt: now
            };
        return account;
      }),
      findUnique: jest.fn(async ({ where }: {
        where: { email?: string; staffNo?: string };
      }) => {
        if (!account) {
          return null;
        }
        if (where.email && account.email !== where.email) {
          return null;
        }
        if (where.staffNo && account.staffNo !== where.staffNo) {
          return null;
        }
        return account;
      }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        account = account ? { ...account, ...data } : null;
        return account;
      })
    },
    adminStaffSession: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        sessionSequence += 1;
        const session = {
          ...data,
          id: `session_${sessionSequence}`,
          revokedAt: null,
          createdAt: new Date()
        };
        sessions.set(String(data.token), session);
        return session;
      }),
      findUnique: jest.fn(async ({ where }: { where: { token: string } }) => {
        const session = sessions.get(where.token);
        return session && account ? { ...session, staff: account } : null;
      }),
      update: jest.fn(async ({ where, data }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const entry = Array.from(sessions.entries()).find(
          ([, session]) => session.id === where.id
        );

        if (!entry) {
          return null;
        }

        const updated = { ...entry[1], ...data };
        sessions.set(entry[0], updated);
        return updated;
      })
    },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    )
  };

  return {
    prisma,
    getAccount: () => account,
    getSession: (token: string) => sessions.get(token),
    updateAccount: (data: Record<string, unknown>) => {
      account = account ? { ...account, ...data } : null;
    },
    updateSession: (token: string, data: Record<string, unknown>) => {
      const session = sessions.get(token);
      if (session) {
        sessions.set(token, { ...session, ...data });
      }
    },
    seedAccount: (data: Record<string, unknown>) => {
      account = {
        id: "staff_owner_id",
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
    }
  };
}

describe("AdminAuthService", () => {
  const createMemoryService = () =>
    new AdminAuthService(
      createStaffService() as never,
      new ConfigService({ NODE_ENV: "test" }),
      {} as never
    );
  const productionConfig = {
    NODE_ENV: "production",
    ADMIN_OWNER_EMAIL: "secure-owner@pets.example.com",
    ADMIN_OWNER_PASSWORD: "secure-owner-secret",
    ADMIN_OWNER_NAME: "Pet Operations Owner",
    ADMIN_SESSION_TTL_HOURS: "12"
  };

  it("fails closed when production has no active owner", async () => {
    const store = createPersistentPrisma();
    const service = new AdminAuthService(
      createStaffService() as never,
      new ConfigService(productionConfig),
      store.prisma as never
    );

    await expect(service.onModuleInit()).rejects.toThrow(
      "No active admin owner exists"
    );
  });

  it("logs in a seeded owner account and resolves the memory session", async () => {
    const service = createMemoryService();

    const login = await service.login({
      email: "owner@example.com",
      password: "owner123456"
    });

    expect(login.sessionToken).toMatch(/^admin_/);
    expect(login.staff).toMatchObject({
      staffNo: "STAFF_OWNER",
      role: "owner"
    });
    await expect(service.getSession(login.sessionToken)).resolves.toMatchObject({
      staffNo: "STAFF_OWNER",
      role: "owner"
    });
  });

  it("rejects an incorrect password and a disabled development account", async () => {
    const service = createMemoryService();

    await expect(
      service.login({
        email: "owner@example.com",
        password: "wrong-password"
      })
    ).rejects.toThrow("Invalid admin credentials");
    await expect(
      service.login({
        email: "disabled@example.com",
        password: "disabled123456"
      })
    ).rejects.toThrow("Admin account is disabled");
  });

  it("invalidates a memory session after logout", async () => {
    const service = createMemoryService();
    const login = await service.login({
      email: "operator@example.com",
      password: "operator123456"
    });

    await service.logout(login.sessionToken);

    await expect(service.getSession(login.sessionToken)).rejects.toThrow(
      "Invalid admin session"
    );
  });

  it("persists a production session across service restarts using scrypt", async () => {
    const store = createPersistentPrisma();
    const firstStaffService = createStaffService();
    const firstService = new AdminAuthService(
      firstStaffService as never,
      new ConfigService(productionConfig),
      store.prisma as never
    );
    store.seedAccount({
      staffNo: "STAFF_OWNER",
      name: productionConfig.ADMIN_OWNER_NAME,
      email: productionConfig.ADMIN_OWNER_EMAIL,
      passwordHash: (firstService as never as { hashPassword: (password: string) => string }).hashPassword(
        productionConfig.ADMIN_OWNER_PASSWORD
      ),
      role: "owner",
      permissions: [...ADMIN_OWNER_PERMISSIONS],
      status: "active"
    });
    await firstService.onModuleInit();

    const login = await firstService.login({
      email: "secure-owner@pets.example.com",
      password: "secure-owner-secret"
    });
    const persistedAccount = store.getAccount();

    expect(persistedAccount?.passwordHash).toEqual(
      expect.stringMatching(/^scrypt\$/)
    );
    expect(persistedAccount?.passwordHash).not.toContain("secure-owner-secret");
    expect(login.staff).toMatchObject({
      name: "Pet Operations Owner",
      role: "owner",
      staffNo: "STAFF_OWNER"
    });
    expect(firstStaffService.recordOperation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "security.admin_login",
        targetId: expect.not.stringContaining(login.sessionToken),
        summary: expect.not.stringContaining(login.sessionToken)
      })
    );

    const restartedService = new AdminAuthService(
      createStaffService() as never,
      new ConfigService(productionConfig),
      store.prisma as never
    );
    await restartedService.onModuleInit();

    await expect(
      restartedService.getSession(login.sessionToken)
    ).resolves.toMatchObject({
      staffNo: "STAFF_OWNER",
      role: "owner"
    });

    await restartedService.logout(login.sessionToken);
    await expect(
      restartedService.getSession(login.sessionToken)
    ).rejects.toThrow("Invalid admin session");
  });

  it("rejects expired sessions and sessions belonging to disabled staff", async () => {
    const store = createPersistentPrisma();
    const service = new AdminAuthService(
      createStaffService() as never,
      new ConfigService(productionConfig),
      store.prisma as never
    );
    store.seedAccount({
      staffNo: "STAFF_OWNER",
      name: productionConfig.ADMIN_OWNER_NAME,
      email: productionConfig.ADMIN_OWNER_EMAIL,
      passwordHash: (service as never as { hashPassword: (password: string) => string }).hashPassword(
        productionConfig.ADMIN_OWNER_PASSWORD
      ),
      role: "owner",
      permissions: [...ADMIN_OWNER_PERMISSIONS],
      status: "active"
    });
    await service.onModuleInit();
    const expiredLogin = await service.login({
      email: productionConfig.ADMIN_OWNER_EMAIL,
      password: productionConfig.ADMIN_OWNER_PASSWORD
    });
    store.updateSession(expiredLogin.sessionToken, {
      expiresAt: new Date(Date.now() - 1_000)
    });

    await expect(service.getSession(expiredLogin.sessionToken)).rejects.toThrow(
      "Invalid admin session"
    );

    const disabledLogin = await service.login({
      email: productionConfig.ADMIN_OWNER_EMAIL,
      password: productionConfig.ADMIN_OWNER_PASSWORD
    });
    store.updateAccount({ status: "disabled" });

    await expect(service.getSession(disabledLogin.sessionToken)).rejects.toThrow(
      "Invalid admin session"
    );
  });
});
