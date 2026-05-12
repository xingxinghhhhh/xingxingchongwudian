import { Controller, Get } from "@nestjs/common";
import { DatabaseHealthService } from "./database/database-health.service";

@Controller("health")
export class AppController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "pet-toy-shop-api",
      database: this.databaseHealthService.getStatus()
    };
  }
}
