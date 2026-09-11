import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Optional,
  Logger,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Request, Response } from "express";
import { RedisService } from "../../modules/redis/redis.service";

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
export const IDEMPOTENCY_TTL_SECONDS = 300; // 5 minutes cache

interface CachedIdempotentResponse {
  statusCode: number;
  body: unknown;
  savedAt: string;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly memoryCache = new Map<
    string,
    { data: string; expiresAt: number }
  >();

  constructor(@Optional() private readonly redisService?: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const rawKey =
      req.headers[IDEMPOTENCY_KEY_HEADER] ||
      req.headers["Idempotency-Key"] ||
      req.headers["idempotency-key"];

    if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
      return next.handle();
    }

    const idempotencyKey = `idemp:${rawKey.trim()}`;

    // 1. Read existing state
    const existing = await this.getCache(idempotencyKey);
    if (existing) {
      if (existing === "IN_PROGRESS") {
        throw new ConflictException(
          "Une requête concurrente avec la même clé d'idempotence est actuellement en cours de traitement.",
        );
      }

      try {
        const cached: CachedIdempotentResponse = JSON.parse(existing);
        res.setHeader("X-Idempotent-Replayed", "true");
        res.setHeader("X-Idempotency-Key", rawKey.trim());
        if (cached.statusCode) {
          res.status(cached.statusCode);
        }
        this.logger.log(
          `[Idempotency] Replaying cached response for key: ${rawKey.trim()}`,
        );
        return of(cached.body);
      } catch {
        // Corrupted cache: allow pass-through
      }
    }

    // 2. Lock key with IN_PROGRESS
    await this.setCache(idempotencyKey, "IN_PROGRESS", 60);

    return next.handle().pipe(
      tap(async (responseBody) => {
        const cachePayload: CachedIdempotentResponse = {
          statusCode: res.statusCode || 200,
          body: responseBody,
          savedAt: new Date().toISOString(),
        };
        await this.setCache(
          idempotencyKey,
          JSON.stringify(cachePayload),
          IDEMPOTENCY_TTL_SECONDS,
        );
        res.setHeader("X-Idempotent-Replayed", "false");
        res.setHeader("X-Idempotency-Key", rawKey.trim());
      }),
      catchError(async (err) => {
        // Unlock on error so client can retry
        await this.delCache(idempotencyKey);
        throw err;
      }),
    );
  }

  private async getCache(key: string): Promise<string | null> {
    if (this.redisService) {
      const client = this.redisService.getClient();
      if (client && client.status === "ready") {
        try {
          return await client.get(key);
        } catch (e) {
          this.logger.warn(`Redis get error: ${(e as Error).message}`);
        }
      }
    }

    const mem = this.memoryCache.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.data;
    }
    if (mem) {
      this.memoryCache.delete(key);
    }
    return null;
  }

  private async setCache(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    if (this.redisService) {
      const client = this.redisService.getClient();
      if (client && client.status === "ready") {
        try {
          await client.set(key, value, "EX", ttlSeconds);
          return;
        } catch (e) {
          this.logger.warn(`Redis set error: ${(e as Error).message}`);
        }
      }
    }

    this.memoryCache.set(key, {
      data: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private async delCache(key: string): Promise<void> {
    if (this.redisService) {
      const client = this.redisService.getClient();
      if (client && client.status === "ready") {
        try {
          await client.del(key);
          return;
        } catch (e) {
          this.logger.warn(`Redis del error: ${(e as Error).message}`);
        }
      }
    }
    this.memoryCache.delete(key);
  }
}
