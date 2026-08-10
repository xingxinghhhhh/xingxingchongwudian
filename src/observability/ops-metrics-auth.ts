import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { resolveOpsMetricsToken } from "../config/ops-metrics";

@Injectable()
export class OpsMetricsAuthService {
  constructor(private readonly configService: ConfigService) {}

  isAuthorized(providedToken?: string) {
    if (!providedToken) return false;
    const expectedToken = resolveOpsMetricsToken({
      NODE_ENV: this.configService.get<string>("NODE_ENV"),
      OPS_METRICS_TOKEN: this.configService.get<string>("OPS_METRICS_TOKEN")
    });
    const provided = Buffer.from(providedToken);
    const expected = Buffer.from(expectedToken);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }
}
