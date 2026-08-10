import { Controller, Get, Headers, Header, UnauthorizedException } from "@nestjs/common";
import { CloudPetOpsMetricsService } from "./cloud-pet-ops-metrics";
import { OpsMetricsAuthService } from "./ops-metrics-auth";

@Controller("internal/ops")
export class OpsMetricsController {
  constructor(
    private readonly metricsService: CloudPetOpsMetricsService,
    private readonly authService: OpsMetricsAuthService
  ) {}

  @Get("cloud-pet-health")
  @Header("Cache-Control", "no-store")
  async getCloudPetHealth(@Headers("x-ops-metrics-token") token?: string) {
    if (!this.authService.isAuthorized(token)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: "未授权访问运营指标",
        error: "Unauthorized",
        code: "OPS_METRICS_UNAUTHORIZED"
      });
    }
    return this.metricsService.getHealthSnapshot();
  }
}
