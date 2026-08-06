import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseHealthService } from "./database/database-health.service";

@Controller("health")
export class AppController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  health() {
    return this.liveness();
  }

  @Get("live")
  liveness() {
    return {
      status: "ok",
      service: "pet-toy-shop-api",
      database: this.databaseHealthService.getStatus()
    };
  }

  @Get("ready")
  async readiness() {
    const readiness = await this.databaseHealthService.checkReadiness();
    const response = {
      status: readiness.ready ? "ready" : "not_ready",
      service: "pet-toy-shop-api",
      database: readiness.database
    };

    if (!readiness.ready) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
