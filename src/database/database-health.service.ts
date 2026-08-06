import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma.service";

@Injectable()
export class DatabaseHealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  getStatus() {
    const configured = this.isDatabaseConfigured();

    return {
      orm: "prisma",
      provider: "sqlite",
      mode: configured ? "database" : "memory",
      configured
    };
  }

  async checkReadiness() {
    const database = this.getStatus();

    if (!database.configured) {
      return {
        ready: true,
        database: {
          ...database,
          connected: null
        }
      };
    }

    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");
      return {
        ready: true,
        database: {
          ...database,
          connected: true
        }
      };
    } catch {
      return {
        ready: false,
        database: {
          ...database,
          connected: false
        }
      };
    }
  }

  private isDatabaseConfigured() {
    return (
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"))
    );
  }
}
