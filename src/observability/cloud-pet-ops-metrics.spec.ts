import { CloudPetOpsMetricsService } from "./cloud-pet-ops-metrics";

describe("CloudPetOpsMetricsService", () => {
  const readiness = { ready: true, database: "ok" };
  const httpMetrics = {
    scope: "process" as const,
    windowSeconds: 300,
    processStartedAt: "2026-08-09T00:00:00.000Z",
    requestCount: 20,
    clientErrorCount: 0,
    serverErrorCount: 1,
    rateLimitedCount: 0,
    serverErrorRate: 0.05
  };

  it("projects operational metrics and marks a high 5xx rate critical", async () => {
    const service = new CloudPetOpsMetricsService(
      { checkReadiness: jest.fn().mockResolvedValue(readiness) } as never,
      {
        getDailyDiaryStatusForToday: jest.fn().mockResolvedValue({
          date: "2026-08-09",
          generatedTodayCount: 8,
          missingTodayCount: 2,
          coverageRate: 0.8
        })
      } as never,
      { getMetrics: jest.fn().mockResolvedValue({ pendingCommunityReportCount: 3 }) } as never,
      { snapshot: jest.fn().mockReturnValue(httpMetrics) } as never
    );

    await expect(service.getHealthSnapshot()).resolves.toMatchObject({
      status: "critical",
      reasons: ["HTTP_5XX_RATE_HIGH"],
      cloudPet: {
        dailyDiary: { date: "2026-08-09", coveredCount: 8, missingCount: 2, coverageRate: 0.8 },
        communityModeration: { openReportCount: 3 }
      }
    });
  });

  it("does not query cloud-pet data when readiness fails", async () => {
    const getDailyDiaryStatusForToday = jest.fn();
    const getMetrics = jest.fn();
    const service = new CloudPetOpsMetricsService(
      { checkReadiness: jest.fn().mockResolvedValue({ ready: false, database: "error" }) } as never,
      { getDailyDiaryStatusForToday } as never,
      { getMetrics } as never,
      { snapshot: jest.fn().mockReturnValue({ ...httpMetrics, requestCount: 0, serverErrorCount: 0, serverErrorRate: 0 }) } as never
    );

    await expect(service.getHealthSnapshot()).resolves.toMatchObject({
      status: "critical",
      reasons: ["READINESS_FAILED"],
      cloudPet: { dailyDiary: null, communityModeration: null }
    });
    expect(getDailyDiaryStatusForToday).not.toHaveBeenCalled();
    expect(getMetrics).not.toHaveBeenCalled();
  });

  it("returns a safe admin projection without process or database details", async () => {
    const service = new CloudPetOpsMetricsService(
      {
        checkReadiness: jest.fn().mockResolvedValue({
          ready: true,
          database: { provider: "sqlite", mode: "database", connected: true }
        })
      } as never,
      {
        getDailyDiaryStatusForToday: jest.fn().mockResolvedValue({
          date: "2026-08-09",
          generatedTodayCount: 4,
          missingTodayCount: 1,
          coverageRate: 0.8
        })
      } as never,
      { getMetrics: jest.fn().mockResolvedValue({ pendingCommunityReportCount: 2 }) } as never,
      {
        snapshot: jest.fn().mockReturnValue({
          ...httpMetrics,
          processStartedAt: "2026-08-08T00:00:00.000Z"
        })
      } as never
    );

    const snapshot = await service.getAdminHealthSnapshot();

    expect(snapshot).toMatchObject({
      status: "critical",
      readiness: { ready: true },
      http: {
        scope: "process",
        windowSeconds: 300,
        requestCount: 20,
        serverErrorCount: 1,
        rateLimitedCount: 0
      },
      cloudPet: {
        dailyDiary: { date: "2026-08-09", coveredCount: 4, missingCount: 1 },
        communityModeration: { openReportCount: 2 }
      }
    });
    expect(snapshot.readiness).not.toHaveProperty("database");
    expect(snapshot.http).not.toHaveProperty("processStartedAt");
  });
});
