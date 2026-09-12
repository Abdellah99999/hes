import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis, { RedisOptions } from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>("redis.url");
    const host = this.configService.get<string>("redis.host", "localhost");
    const port = this.configService.get<number>("redis.port", 6379);
    const password = this.configService.get<string>("redis.password", "");

    const baseOptions: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 100, 1000);
      },
    };

    try {
      if (url) {
        this.client = new Redis(url, baseOptions);
        this.logger.log("Redis client configured via REDIS_URL");
      } else {
        this.client = new Redis({
          ...baseOptions,
          host,
          port,
          password: password || undefined,
        });
        this.logger.log(`Redis client configured for ${host}:${port}`);
      }

      this.client.on("error", (err) => {
        this.logger.warn(`Redis client warning/error: ${err.message}`);
      });
    } catch (error) {
      this.logger.error("Failed to initialize Redis client", error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log("Redis client disconnected cleanly.");
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async isHealthy(): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    if (!this.client) {
      return {
        healthy: false,
        latencyMs: 0,
        error: "Redis client is not initialized",
      };
    }

    try {
      if (
        this.client.status !== "ready" &&
        this.client.status !== "connecting"
      ) {
        await this.client.connect().catch(() => {});
      }
      const response = await this.client.ping();
      const healthy = response === "PONG";
      return {
        healthy,
        latencyMs: Date.now() - start,
        error: healthy ? undefined : `Unexpected ping response: ${response}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Redis ping failed",
      };
    }
  }
}
