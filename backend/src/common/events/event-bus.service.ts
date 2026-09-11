import { Injectable, Logger, Optional } from "@nestjs/common";
import { DomainEvent } from "./domain-event.interface";
import { RedisService } from "../../modules/redis/redis.service";

export type DomainEventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => Promise<void> | void;

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, Array<DomainEventHandler>>();

  constructor(@Optional() private readonly redisService?: RedisService) {}

  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: DomainEventHandler<T>,
  ): void {
    const list = this.handlers.get(eventName) || [];
    list.push(handler as DomainEventHandler);
    this.handlers.set(eventName, list);
  }

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.logger.log(
      `[EventBus] Publishing event '${event.eventName}' (ID: ${event.eventId})`,
    );

    // 1. Process internal subscribers
    const list = this.handlers.get(event.eventName) || [];
    for (const handler of list) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `[EventBus] Error executing subscriber for ${event.eventName}:`,
          error,
        );
      }
    }

    // 2. Publish to Redis channel if Redis client is available
    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client && client.status === "ready") {
          await client.publish(
            `hes:events:${event.eventName}`,
            JSON.stringify(event),
          );
        }
      } catch (redisError) {
        this.logger.warn(
          `[EventBus] Redis pub/sub failed for ${event.eventName}: ${(redisError as Error).message}`,
        );
      }
    }
  }
}
