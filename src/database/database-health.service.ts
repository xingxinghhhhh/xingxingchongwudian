import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DatabaseHealthService {
  constructor(private readonly configService: ConfigService) {}

  getStatus() {
    return {
      orm: "prisma",
      provider: "mysql",
      configured: Boolean(this.configService.get<string>("DATABASE_URL"))
    };
  }
}
