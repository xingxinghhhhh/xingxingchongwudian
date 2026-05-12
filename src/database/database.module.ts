import { Module } from "@nestjs/common";
import { DatabaseHealthService } from "./database-health.service";
import { PrismaService } from "./prisma.service";

@Module({
  providers: [DatabaseHealthService, PrismaService],
  exports: [DatabaseHealthService, PrismaService]
})
export class DatabaseModule {}
