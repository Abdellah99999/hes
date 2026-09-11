import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { StorageService } from "../storage/storage.service";
import { HealthResponseDto } from "./dto/health-response.dto";

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  async checkHealth(): Promise<{
    data: HealthResponseDto;
    isHealthy: boolean;
  }> {
    const [dbResult, redisResult, storageResult] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
      this.storage.isHealthy(),
    ]);

    const isDbUp = dbResult.healthy;
    const isRedisUp = redisResult.healthy;
    const isStorageUp = storageResult.healthy;

    const allUp = isDbUp && isRedisUp && isStorageUp;
    const noneUp = !isDbUp && !isRedisUp && !isStorageUp;

    let overallStatus: "ok" | "degraded" | "error" = "ok";
    if (noneUp || !isDbUp) {
      // If DB is down or everything is down, status is error
      overallStatus = "error";
    } else if (!allUp) {
      // If DB is up but Redis or MinIO is down, status is degraded
      overallStatus = "degraded";
    }

    const response: HealthResponseDto = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        database: {
          status: isDbUp ? "up" : "down",
          latencyMs: dbResult.latencyMs,
          error: dbResult.error,
        },
        redis: {
          status: isRedisUp ? "up" : "down",
          latencyMs: redisResult.latencyMs,
          error: redisResult.error,
        },
        storage: {
          status: isStorageUp ? "up" : "down",
          latencyMs: storageResult.latencyMs,
          error: storageResult.error,
        },
      },
    };

    return {
      data: response,
      isHealthy: overallStatus === "ok" || overallStatus === "degraded",
    };
  }
}
