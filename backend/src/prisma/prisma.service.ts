import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log(
        "✅ PostgreSQL Database connected successfully via Prisma.",
      );
    } catch (error) {
      this.logger.error("❌ Failed to connect to PostgreSQL database:", error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log("PostgreSQL Prisma connection disconnected cleanly.");
  }

  async isHealthy(): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Database ping failed",
      };
    }
  }
}
