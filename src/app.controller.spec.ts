import { AppController } from "./app.controller";

describe("AppController health probes", () => {
  it("returns 503 readiness without leaking the database error", async () => {
    const controller = new AppController({
      getStatus: jest.fn(),
      checkReadiness: jest.fn().mockResolvedValue({
        ready: false,
        database: {
          orm: "prisma",
          provider: "sqlite",
          mode: "database",
          configured: true,
          connected: false
        }
      })
    } as never);

    await expect(controller.readiness()).rejects.toMatchObject({
      response: {
        status: "not_ready",
        service: "pet-toy-shop-api",
        database: {
          orm: "prisma",
          provider: "sqlite",
          mode: "database",
          configured: true,
          connected: false
        }
      },
      status: 503
    });
  });
});
