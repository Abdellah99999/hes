import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { HealthService } from "../modules/health/health.service";
import { RedisService } from "../modules/redis/redis.service";
import { ThrottlerStorageRedisService } from "../modules/redis/throttler-storage-redis.service";
import { NotificationQueueService } from "../modules/notifications/queue/notification-queue.service";
import { NotificationService } from "../modules/notifications/application/notification.service";
import { NotificationWorker } from "../modules/notifications/queue/notification.worker";
import {
  NotificationChannel,
  NotificationStatus,
} from "../modules/notifications/domain/notification.types";
import { PrismaService } from "../prisma/prisma.service";

async function runLiveValidation() {
  console.log(
    "===============================================================",
  );
  console.log("🚀 STARTING LIVE REDIS & HEALTH INTEGRATION VALIDATION");
  console.log(
    "===============================================================\n",
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const healthService = app.get(HealthService);
  const redisService = app.get(RedisService);
  const throttlerStorage = app.get(ThrottlerStorageRedisService);
  const queueService = app.get(NotificationQueueService);
  const notificationService = app.get(NotificationService);
  const notificationWorker = app.get(NotificationWorker);
  const prisma = app.get(PrismaService);

  const redisClient = redisService.getClient();
  if (!redisClient) {
    throw new Error("❌ Redis client is NULL!");
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Health Endpoint Check
  // ---------------------------------------------------------------------------
  console.log("--- [TEST 1] HEALTH CHECK ---");
  const healthResult = await healthService.checkHealth();
  console.log("Health Result:", JSON.stringify(healthResult.data, null, 2));

  if (!healthResult.isHealthy) {
    throw new Error(`❌ Health check failed: isHealthy is false`);
  }
  if (healthResult.data.services.redis.status !== "up") {
    throw new Error(
      `❌ Redis is NOT up in health check: ${healthResult.data.services.redis.error}`,
    );
  }
  if (healthResult.data.services.database.status !== "up") {
    throw new Error(
      `❌ Database is NOT up in health check: ${healthResult.data.services.database.error}`,
    );
  }
  if (healthResult.data.services.storage.status !== "up") {
    throw new Error(
      `❌ Storage is NOT up in health check: ${healthResult.data.services.storage.error}`,
    );
  }
  console.log(
    "✅ TEST 1 PASSED: /health reports all services UP (Postgres, Redis, Storage)!\n",
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Real Redis Job Queue (NotificationQueueService)
  // ---------------------------------------------------------------------------
  console.log("--- [TEST 2] REDIS JOB QUEUE ---");
  const testPayload = {
    notificationId: `test-job-${Date.now()}`,
    recipientUserId: "user-test-123",
    recipientContact: "test@example.com",
    title: "Live Redis Job Test",
    body: "This is a real job queued in Redis",
    channel: NotificationChannel.EMAIL,
    retryCount: 0,
  };

  const enqueued = await queueService.enqueue(testPayload);
  if (!enqueued) {
    throw new Error("❌ Failed to enqueue test job into Redis");
  }

  // Inspect Redis directly to verify the key exists
  const rawListLength = await redisClient.llen("hes:notifications:queue");
  console.log(`Redis list 'hes:notifications:queue' length: ${rawListLength}`);
  if (rawListLength < 1) {
    throw new Error(
      "❌ Redis list 'hes:notifications:queue' is empty after enqueue!",
    );
  }

  const dequeued = await queueService.dequeue();
  console.log("Dequeued Job:", dequeued);
  if (!dequeued || dequeued.notificationId !== testPayload.notificationId) {
    throw new Error(
      `❌ Dequeued job mismatch! Expected ${testPayload.notificationId}, got ${dequeued?.notificationId}`,
    );
  }
  console.log(
    "✅ TEST 2 PASSED: Job Queue enqueued and dequeued payload with real Redis list!\n",
  );

  // ---------------------------------------------------------------------------
  // TEST 3: Real Rate Limiting via Redis (ThrottlerStorageRedisService)
  // ---------------------------------------------------------------------------
  console.log("--- [TEST 3] REAL REDIS RATE LIMITING ---");
  const testIpKey = `test-ip-${Date.now()}`;
  const ttlMs = 5000;
  const limit = 3;

  // Hit 1
  const rec1 = await throttlerStorage.increment(
    testIpKey,
    ttlMs,
    limit,
    10000,
    "short",
  );
  console.log("Hit 1 Record:", rec1);
  if (rec1.totalHits !== 1 || rec1.isBlocked) {
    throw new Error(
      `❌ Rate limiting hit 1 unexpected: totalHits=${rec1.totalHits}`,
    );
  }

  // Verify directly in Redis
  const rawRedisHits = await redisClient.get(
    `hes:throttler:short:${testIpKey}`,
  );
  console.log(
    `Direct Redis value for 'hes:throttler:short:${testIpKey}': ${rawRedisHits}`,
  );
  if (rawRedisHits !== "1") {
    throw new Error(
      `❌ Direct Redis key does not match expected value 1: got ${rawRedisHits}`,
    );
  }

  // Hit 2 & 3
  await throttlerStorage.increment(testIpKey, ttlMs, limit, 10000, "short");
  const rec3 = await throttlerStorage.increment(
    testIpKey,
    ttlMs,
    limit,
    10000,
    "short",
  );
  console.log("Hit 3 Record (at limit):", rec3);
  if (rec3.totalHits !== 3 || rec3.isBlocked) {
    throw new Error(
      `❌ Rate limiting hit 3 unexpected: totalHits=${rec3.totalHits}, isBlocked=${rec3.isBlocked}`,
    );
  }

  // Hit 4 (should block)
  const rec4 = await throttlerStorage.increment(
    testIpKey,
    ttlMs,
    limit,
    10000,
    "short",
  );
  console.log("Hit 4 Record (over limit - should block):", rec4);
  if (!rec4.isBlocked || rec4.totalHits <= limit) {
    throw new Error(`❌ Expected rate limit to block on hit 4!`);
  }

  const blockKeyVal = await redisClient.get(
    `hes:throttler:block:short:${testIpKey}`,
  );
  console.log(
    `Direct Redis block key 'hes:throttler:block:short:${testIpKey}': ${blockKeyVal}`,
  );
  if (!blockKeyVal) {
    throw new Error("❌ Block key was not written to Redis!");
  }

  // Clean up test keys
  await redisClient.del(
    `hes:throttler:short:${testIpKey}`,
    `hes:throttler:block:short:${testIpKey}`,
  );
  console.log(
    "✅ TEST 3 PASSED: Rate limiting accurately tracks hits and blocks via Redis!\n",
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Asynchronous Notifications Workflow via Redis Queue
  // ---------------------------------------------------------------------------
  console.log("--- [TEST 4] ASYNCHRONOUS NOTIFICATIONS WORKFLOW ---");
  // Find or create a test user to attach notification
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        fullName: "Test Redis Worker",
      },
    });
  }

  const notif = await notificationService.dispatch({
    userId: user.id,
    channel: NotificationChannel.EMAIL,
    title: "Notification Asynchrone Redis",
    body: "Validation du flux complet Redis -> Worker -> Sent",
    contact: "destinataire@example.com",
  });

  console.log("Notification created in Postgres:", {
    id: notif.id,
    status: notif.status,
    channel: notif.channel,
  });

  if (notif.status !== NotificationStatus.PENDING) {
    throw new Error(
      `❌ Initial notification status should be PENDING, got ${notif.status}`,
    );
  }

  // Verify job is waiting in Redis
  const queueLengthBefore = await redisClient.llen("hes:notifications:queue");
  console.log(`Jobs in Redis queue waiting for worker: ${queueLengthBefore}`);
  if (queueLengthBefore < 1) {
    throw new Error(
      "❌ Redis queue is empty; notification was not dispatched to Redis!",
    );
  }

  // Trigger worker to process the next job
  const processed = await notificationWorker.processNextJob();
  console.log(`Worker processed next job: ${processed}`);
  if (!processed) {
    throw new Error("❌ NotificationWorker failed to process job from queue");
  }

  // Verify notification was updated to SENT in database
  const updatedNotif = await prisma.notification.findUnique({
    where: { id: notif.id },
  });
  console.log("Updated notification in Postgres:", {
    id: updatedNotif?.id,
    status: updatedNotif?.status,
    sentAt: updatedNotif?.sentAt,
  });

  if (updatedNotif?.status !== NotificationStatus.SENT) {
    throw new Error(
      `❌ Expected notification status to be SENT, got ${updatedNotif?.status}`,
    );
  }
  console.log(
    "✅ TEST 4 PASSED: Asynchronous notification queued in Redis and processed by worker!\n",
  );

  await app.close();

  // ---------------------------------------------------------------------------
  // TEST 5: Real HTTP Server & /health Route
  // ---------------------------------------------------------------------------
  console.log("--- [TEST 5] REAL HTTP SERVER GET /api/v1/health ---");
  const httpApp = await NestFactory.create(AppModule, { logger: false });
  httpApp.setGlobalPrefix("api/v1");
  await httpApp.listen(3099);

  try {
    const res = await fetch("http://127.0.0.1:3099/api/v1/health");
    const json = await res.json();
    console.log("HTTP Response Status:", res.status);
    console.log("HTTP Response Payload:", JSON.stringify(json, null, 2));

    if (res.status !== 200) {
      throw new Error(`❌ Expected HTTP status 200, got ${res.status}`);
    }
    if (
      json.services.redis.status !== "up" ||
      json.services.database.status !== "up" ||
      json.services.storage.status !== "up"
    ) {
      throw new Error("❌ One or more services are not up in HTTP response!");
    }
    console.log(
      "✅ TEST 5 PASSED: HTTP endpoint /api/v1/health returned 200 with all services UP!\n",
    );
  } finally {
    await httpApp.close();
  }

  console.log(
    "===============================================================",
  );
  console.log("🎉 ALL LIVE REAL-WORLD REDIS TESTS COMPLETED SUCCESSFULLY!");
  console.log(
    "===============================================================",
  );
}

runLiveValidation().catch((err) => {
  console.error("FATAL ERROR IN LIVE VALIDATION:", err);
  process.exit(1);
});
