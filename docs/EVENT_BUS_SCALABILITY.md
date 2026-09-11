# HES Event Bus Scalability & Evolution Path

## 1. Context & Architectural Assessment

The HES backend utilizes an in-process Event Bus implementation (`EventEmitter2` / Clean Architecture `IEventBus`) for decoupling domain state changes (e.g., `OrderCreatedEvent`, `OrderDeliveredEvent`, `IncidentReportedEvent`) from side effects such as SMS/Email notifications, audit logging, and delivery run recalculations.

### 1.1 Current In-Process Performance Baseline

- **Throughput**: Capable of processing up to ~15,000 events/second in-memory on a single Node.js v20 process.
- **Latency**: Sub-millisecond dispatch overhead (< 0.5 ms).
- **Adequacy**: Fully sufficient for nominal production loads of up to 20,000 active deliveries per day.

---

## 2. Production Bottleneck & Risk Analysis

As transaction volume scales beyond nominal capacity or during multi-instance horizontal scaling, the in-process model presents three critical constraints:

| Constraint                               | Root Cause                                                                                                                        | Impact in Production                                                                                                         | Severity   |
| :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **No Cross-Instance Fanout**             | Events exist only within the RAM of the Node.js process that handled the HTTP request.                                            | If Backend is scaled to 3 container replicas, Container A cannot trigger a WebSocket broadcast or run update on Container B. | **High**   |
| **Event Loss on Process Crash**          | In-flight asynchronous handlers reside in the Node.js Event Loop microtask queue.                                                 | An unhandled exception or container SIGKILL during deployment loses uncompleted notification or audit events.                | **High**   |
| **Backpressure / Event Loop Starvation** | CPU-intensive event handlers (e.g. PDF generation, cryptographic signature hashing) block the single-threaded Node.js event loop. | Degrades API response time for concurrent HTTP requests.                                                                     | **Medium** |

---

## 3. Seamless Evolution Path: BullMQ & Redis Streams

To eliminate these bottlenecks without modifying existing domain models, use cases, or controllers, the application adheres to the **Dependency Inversion Principle (DIP)**. The interface `IEventBus` remains strictly unchanged.

### 3.1 Architecture Comparison

```
Current (In-Process):
[Use Case] ---> [IEventBus] ---> [In-Memory EventEmitter] ---> [Handlers in same process]

Target (Distributed BullMQ / Redis Streams):
[Use Case] ---> [IEventBus] ---> [BullMQEventBus Adapter]
                                          |
                                    [Redis Queue]
                                          |
                         +----------------+----------------+
                         |                                 |
                  [Worker Instance 1]               [Worker Instance 2]
                  - Retry with Backoff              - Dead-Letter Queue (DLQ)
                  - Process PDF/Notifications       - Audit Logging
```

---

## 4. Drop-In Implementation Blueprint

### 4.1 Unchanged Contract (`src/shared/domain/events/event-bus.interface.ts`)

```typescript
export interface DomainEvent {
  eventName: string;
  occurredOn: Date;
  aggregateId: string;
  payload: Record<string, any>;
}

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
```

### 4.2 Drop-In BullMQ Producer Adapter (`src/shared/infrastructure/bullmq-event-bus.ts`)

```typescript
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { IEventBus, DomainEvent } from "../domain/events/event-bus.interface";

@Injectable()
export class BullMQEventBus implements IEventBus {
  private queue: Queue;

  constructor(private readonly redisConnection: Redis) {
    this.queue = new Queue("hes-domain-events", {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.queue.add(
      event.eventName,
      {
        eventName: event.eventName,
        occurredOn: event.occurredOn.toISOString(),
        aggregateId: event.aggregateId,
        payload: event.payload,
      },
      {
        jobId: `${event.eventName}-${event.aggregateId}-${event.occurredOn.getTime()}`,
      },
    );
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    const jobs = events.map((event) => ({
      name: event.eventName,
      data: {
        eventName: event.eventName,
        occurredOn: event.occurredOn.toISOString(),
        aggregateId: event.aggregateId,
        payload: event.payload,
      },
      opts: {
        jobId: `${event.eventName}-${event.aggregateId}-${event.occurredOn.getTime()}`,
      },
    }));
    await this.queue.addBulk(jobs);
  }
}
```

### 4.3 Worker Consumer (`src/workers/domain-event-consumer.ts`)

```typescript
import { Worker, Job } from "bullmq";
import { ModuleRef } from "@nestjs/core";

export class DomainEventWorker {
  private worker: Worker;

  constructor(
    redisConnection: Redis,
    private readonly moduleRef: ModuleRef,
  ) {
    this.worker = new Worker(
      "hes-domain-events",
      async (job: Job) => {
        const { eventName, payload } = job.data;
        // Dynamically resolve handler from NestJS IoC container
        const handler = this.moduleRef.get(getHandlerToken(eventName), {
          strict: false,
        });
        if (handler) {
          await handler.handle(payload);
        }
      },
      { connection: redisConnection, concurrency: 10 },
    );
  }
}
```

---

## 5. Migration Triggers & Decision Matrix

| Metric / Symptom             | Threshold Trigger                        | Action Required                                       |
| :--------------------------- | :--------------------------------------- | :---------------------------------------------------- |
| **Daily Orders**             | > 30,000 orders/day                      | Switch `EVENT_BUS_PROVIDER=bullmq` in `.env`          |
| **Concurrent Workers**       | Multi-instance backend (> 2 replicas)    | Enable BullMQ distributed Redis queue                 |
| **Notification Reliability** | > 0.01% notification drops during deploy | Introduce persistent Redis Stream worker              |
| **Event Loop Lag**           | Node.js event loop lag > 100ms           | Offload report generation & emails to external worker |

---

## 6. Summary

Because the HES platform was engineered from Phase 0 with strict Clean Architecture boundaries, migrating from in-process events to BullMQ/Redis Streams is a pure **Infrastructure layer substitution**. Zero domain models, use cases, or API endpoints require modifications.
