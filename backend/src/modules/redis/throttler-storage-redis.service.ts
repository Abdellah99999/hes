import { Injectable, Logger } from "@nestjs/common";
import { ThrottlerStorage, ThrottlerStorageService } from "@nestjs/throttler";
import { RedisService } from "./redis.service";

type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage["increment"]>
>;

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerStorageRedisService.name);
  private readonly fallbackStorage = new ThrottlerStorageService();

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisService.getClient();

    if (!client || client.status !== "ready") {
      return this.fallbackStorage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    const redisKey = `hes:throttler:${throttlerName}:${key}`;
    const blockKey = `hes:throttler:block:${throttlerName}:${key}`;

    try {
      if (blockDuration > 0) {
        const isBlocked = await client.get(blockKey);
        if (isBlocked) {
          const timeToBlockExpire = Math.max(0, await client.pttl(blockKey));
          return {
            totalHits: limit + 1,
            timeToExpire: Math.ceil(timeToBlockExpire / 1000),
            isBlocked: true,
            timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
          };
        }
      }

      const totalHits = await client.incr(redisKey);
      if (totalHits === 1) {
        await client.pexpire(redisKey, ttl);
      }

      let pttl = await client.pttl(redisKey);
      if (pttl < 0) {
        await client.pexpire(redisKey, ttl);
        pttl = ttl;
      }

      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        await client.psetex(blockKey, blockDuration, "blocked");
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, Math.ceil(pttl / 1000)),
        isBlocked,
        timeToBlockExpire,
      };
    } catch (error) {
      this.logger.warn(
        `Redis rate limiting failed, falling back to memory: ${(error as Error).message}`,
      );
      return this.fallbackStorage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }
}
