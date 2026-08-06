import { ConfigService } from "@nestjs/config";
import { DatabaseHealthService } from "./database-health.service";

function createService(
  config: Record<string, string | undefined>,
  query: jest.Mock = jest.fn().mockResolvedValue([{ "1": 1 }])
) {
  return new DatabaseHealthService(new ConfigService(config), {
    $queryRawUnsafe: query
  } as never);
}

describe("DatabaseHealthService", () => {
  it("reports the explicit memory mode as ready without querying Prisma", async () => {
    const query = jest.fn();
    const service = createService(
      {
        DATABASE_URL: "file:./dev.db",
        KZT_USE_MEMORY_STORE: "true"
      },
      query
    );

    await expect(service.checkReadiness()).resolves.toEqual({
      ready: true,
      database: {
        orm: "prisma",
        provider: "sqlite",
        mode: "memory",
        configured: false,
        connected: null
      }
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("reports a successful database query as ready", async () => {
    const query = jest.fn().mockResolvedValue([{ "1": 1 }]);
    const service = createService({ DATABASE_URL: "file:./dev.db" }, query);

    await expect(service.checkReadiness()).resolves.toMatchObject({
      ready: true,
      database: {
        provider: "sqlite",
        mode: "database",
        configured: true,
        connected: true
      }
    });
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("reports a failed database query as not ready without exposing the error", async () => {
    const service = createService(
      { DATABASE_URL: "file:./dev.db" },
      jest.fn().mockRejectedValue(new Error("database credentials leaked here"))
    );

    await expect(service.checkReadiness()).resolves.toMatchObject({
      ready: false,
      database: {
        mode: "database",
        connected: false
      }
    });
  });
});
