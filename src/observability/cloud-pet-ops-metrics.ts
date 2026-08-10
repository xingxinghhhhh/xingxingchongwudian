import { Injectable } from "@nestjs/common";
import { CloudPetsService } from "../cloud-pets/cloud-pets.service";
import { DatabaseHealthService } from "../database/database-health.service";
import {
  HttpRollingMetrics,
  HttpRollingMetricsSnapshot
} from "./http-rolling-metrics";
import { CommunityService } from "../community/community.service";

export type CloudPetOpsMetricsSnapshot = {
  timestamp: string;
  status: "healthy" | "critical";
  reasons: string[];
  readiness: Awaited<ReturnType<DatabaseHealthService["checkReadiness"]>>;
  http: HttpRollingMetricsSnapshot;
  cloudPet: {
    dailyDiary: {
      date: string;
      coveredCount: number;
      missingCount: number;
      coverageRate: number;
    } | null;
    communityModeration: { openReportCount: number } | null;
  };
};

export type CloudPetOpsAdminHealthSnapshot = {
  timestamp: string;
  status: CloudPetOpsMetricsSnapshot["status"];
  reasons: string[];
  readiness: { ready: boolean };
  http: Pick<
    HttpRollingMetricsSnapshot,
    | "scope"
    | "windowSeconds"
    | "requestCount"
    | "serverErrorCount"
    | "serverErrorRate"
    | "rateLimitedCount"
  >;
  cloudPet: CloudPetOpsMetricsSnapshot["cloudPet"];
};

@Injectable()
export class CloudPetOpsMetricsService {
  constructor(
    private readonly databaseHealthService: DatabaseHealthService,
    private readonly cloudPetsService: CloudPetsService,
    private readonly communityService: CommunityService,
    private readonly httpMetrics: HttpRollingMetrics
  ) {}

  async getHealthSnapshot(): Promise<CloudPetOpsMetricsSnapshot> {
    const readiness = await this.databaseHealthService.checkReadiness();
    const http = this.httpMetrics.snapshot();
    const reasons: string[] = [];

    if (!readiness.ready) reasons.push("READINESS_FAILED");
    if (http.requestCount >= 20 && http.serverErrorRate >= 0.05) {
      reasons.push("HTTP_5XX_RATE_HIGH");
    }

    let dailyDiary: CloudPetOpsMetricsSnapshot["cloudPet"]["dailyDiary"] = null;
    let communityModeration: CloudPetOpsMetricsSnapshot["cloudPet"]["communityModeration"] = null;
    if (readiness.ready) {
      const [diary, community] = await Promise.all([
        this.cloudPetsService.getDailyDiaryStatusForToday(),
        this.communityService.getMetrics()
      ]);
      dailyDiary = {
        date: diary.date,
        coveredCount: diary.generatedTodayCount,
        missingCount: diary.missingTodayCount,
        coverageRate: diary.coverageRate
      };
      communityModeration = { openReportCount: community.pendingCommunityReportCount };
    }

    return {
      timestamp: new Date().toISOString(),
      status: reasons.length === 0 ? "healthy" : "critical",
      reasons,
      readiness,
      http,
      cloudPet: { dailyDiary, communityModeration }
    };
  }

  async getAdminHealthSnapshot(): Promise<CloudPetOpsAdminHealthSnapshot> {
    const snapshot = await this.getHealthSnapshot();

    return {
      timestamp: snapshot.timestamp,
      status: snapshot.status,
      reasons: snapshot.reasons,
      readiness: { ready: snapshot.readiness.ready },
      http: {
        scope: snapshot.http.scope,
        windowSeconds: snapshot.http.windowSeconds,
        requestCount: snapshot.http.requestCount,
        serverErrorCount: snapshot.http.serverErrorCount,
        serverErrorRate: snapshot.http.serverErrorRate,
        rateLimitedCount: snapshot.http.rateLimitedCount
      },
      cloudPet: {
        dailyDiary: snapshot.cloudPet.dailyDiary,
        communityModeration: snapshot.cloudPet.communityModeration
      }
    };
  }
}
