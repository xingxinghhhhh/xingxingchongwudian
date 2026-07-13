import { ConfigService } from "@nestjs/config";
import { AdminAuthService } from "./admin-auth.service";

function createConfigService(databaseUrl?: string): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === "DATABASE_URL" ? databaseUrl : undefined
    )
  } as unknown as ConfigService;
}

describe("AdminAuthService", () => {
  const staffService = {
    recordOperation: jest.fn().mockResolvedValue(undefined)
  };

  it("logs in a seeded owner account and resolves the session in memory", async () => {
    const service = new AdminAuthService(
      createConfigService(),
      staffService as never
    );

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

  it("rejects login with an incorrect password", async () => {
    const service = new AdminAuthService(
      createConfigService(),
      staffService as never
    );

    await expect(
      service.login({
        email: "owner@example.com",
        password: "wrong-password"
      })
    ).rejects.toThrow("Invalid admin credentials");
  });

  it("rejects login for a disabled staff account", async () => {
    const service = new AdminAuthService(
      createConfigService(),
      staffService as never
    );

    await expect(
      service.login({
        email: "disabled@example.com",
        password: "disabled123456"
      })
    ).rejects.toThrow("Admin account is disabled");
  });

  it("invalidates the session after logout", async () => {
    const service = new AdminAuthService(
      createConfigService(),
      staffService as never
    );
    const login = await service.login({
      email: "operator@example.com",
      password: "operator123456"
    });

    await service.logout(login.sessionToken);

    await expect(service.getSession(login.sessionToken)).rejects.toThrow(
      "Invalid admin session"
    );
  });
});
