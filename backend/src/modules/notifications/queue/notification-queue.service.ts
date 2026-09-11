import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";
import { NotificationPayload } from "../domain/notification.types";

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly queueKey = "hes:notifications:queue";

  constructor(private readonly redisService: RedisService) {}

  async enqueue(payload: NotificationPayload): Promise<boolean> {
    const client = this.redisService.getClient();
    if (!client) {
      this.logger.warn(
        "Redis client not available, notification will be processed synchronously or fallback in memory.",
      );
      return false;
    }

    try {
      await client.lpush(this.queueKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      this.logger.error("Failed to enqueue notification in Redis", error);
      return false;
    }
  }

  async dequeue(): Promise<NotificationPayload | null> {
    const client = this.redisService.getClient();
    if (!client) return null;

    try {
      const raw = await client.rpop(this.queueKey);
      if (!raw) return null;
      return JSON.parse(raw) as NotificationPayload;
    } catch (error) {
      this.logger.error("Failed to dequeue notification from Redis", error);
      return null;
    }
  }
}
