/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationService } from "../src/modules/notifications/application/notification.service";
import { NotificationWorker } from "../src/modules/notifications/queue/notification.worker";
import { NotificationQueueService } from "../src/modules/notifications/queue/notification-queue.service";
import { PushNotificationProvider } from "../src/modules/notifications/providers/push-notification.provider";
import { EmailNotificationProvider } from "../src/modules/notifications/providers/email-notification.provider";
import { WhatsappSmsProviderStub } from "../src/modules/notifications/providers/whatsapp-sms.provider.stub";
import {
  NotificationChannel,
  NotificationStatus,
} from "../src/modules/notifications/domain/notification.types";

describe("Phase 14 Backend Tests: Notifications Multi-Canal, Redis Async Worker, Retry & Sensitive Data Protection", () => {
  let notificationService: NotificationService;
  let notificationWorker: NotificationWorker;
  let queueService: NotificationQueueService;
  let pushProvider: PushNotificationProvider;
  let emailProvider: EmailNotificationProvider;
  let whatsappProvider: WhatsappSmsProviderStub;
  let mockPrisma: any;
  let mockRedis: any;

  let notificationsRecord: any[];
  let redisQueue: string[];

  beforeEach(() => {
    notificationsRecord = [];
    redisQueue = [];

    mockRedis = {
      lpush: jest.fn().mockImplementation(async (...args: string[]) => {
        const val = args[1] || "";
        redisQueue.unshift(val);
        return redisQueue.length;
      }),
      rpop: jest.fn().mockImplementation(async () => {
        return redisQueue.pop() || null;
      }),
    };

    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedis),
    };

    mockPrisma = {
      user: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const matchCust = (c: any) =>
            c?.customerId === "cust-1" || c?.id === "cust-1";
          if (matchCust(where) || where.OR?.some(matchCust)) {
            return { id: "user-cust-1", customerId: "cust-1" };
          }
          if (where.agencyId === "ag-tng") {
            return { id: "user-agent-tng", agencyId: "ag-tng" };
          }
          return null;
        }),
      },
      shipment: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return {
            id: where.id,
            senderCustomerId: "cust-1",
          };
        }),
      },
      notification: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const item = {
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
          };
          notificationsRecord.push(item);
          return item;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = notificationsRecord.findIndex((n) => n.id === where.id);
          if (idx !== -1) {
            notificationsRecord[idx] = { ...notificationsRecord[idx], ...data };
            return notificationsRecord[idx];
          }
          return null;
        }),
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          let count = 0;
          for (let i = 0; i < notificationsRecord.length; i++) {
            if (
              (!where.id || notificationsRecord[i].id === where.id) &&
              notificationsRecord[i].userId === where.userId
            ) {
              notificationsRecord[i] = { ...notificationsRecord[i], ...data };
              count++;
            }
          }
          return { count };
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return notificationsRecord.filter((n) => {
            if (where.userId && n.userId !== where.userId) return false;
            if (where.status && n.status !== where.status) return false;
            return true;
          });
        }),
      },
    };

    queueService = new NotificationQueueService(mockRedisService as any);
    pushProvider = new PushNotificationProvider();
    emailProvider = new EmailNotificationProvider();
    whatsappProvider = new WhatsappSmsProviderStub();

    notificationService = new NotificationService(mockPrisma, queueService);
    notificationWorker = new NotificationWorker(
      mockPrisma,
      queueService,
      pushProvider,
      emailProvider,
      whatsappProvider,
    );
  });

  it("Non-blocking Async Dispatch: Immediately returns DB notification and queues in Redis without delay", async () => {
    const notif = await notificationService.dispatch({
      userId: "user-marchand-1",
      channel: NotificationChannel.PUSH,
      title: "Colis Livré",
      body: "Votre expédition HES-CAS-001 a été livrée.",
      contact: "device_token_valid_123",
    });

    expect(notif.id).toBeDefined();
    expect(notif.status).toBe(NotificationStatus.PENDING);
    expect(mockRedis.lpush).toHaveBeenCalled();
    expect(redisQueue).toHaveLength(1);
  });

  it("Worker Processing: Dépiles Redis job and transitions status to SENT", async () => {
    await notificationService.dispatch({
      userId: "user-marchand-1",
      channel: NotificationChannel.PUSH,
      title: "Colis Livré",
      body: "Votre expédition a été livrée.",
      contact: "device_token_valid_123",
    });

    const processed = await notificationWorker.processNextJob();
    expect(processed).toBe(true);

    const saved = notificationsRecord[0];
    expect(saved.status).toBe(NotificationStatus.SENT);
    expect(saved.sentAt).toBeDefined();
  });

  it("Cybersecurity - Sensitive Financial Data Scrubbing: Exact currency amount in push body is sanitized before delivery", async () => {
    const sendSpy = jest.spyOn(pushProvider, "send");

    await notificationService.dispatch({
      userId: "user-marchand-1",
      channel: NotificationChannel.PUSH,
      title: "Encaissement effectué",
      body: "Livraison effectuée avec succès. Montant collecté : 1450.00 MAD.",
      contact: "valid_token",
    });

    await notificationWorker.processNextJob();

    expect(sendSpy).toHaveBeenCalled();
    const calledPayload = sendSpy.mock.calls[0][0];
    expect(calledPayload.body).not.toContain("1450.00 MAD");
    expect(calledPayload.body).toContain("[Information Sécurisée]");
  });

  it("Tolerant Invalid Token Handling: Handles invalid device token cleanly without throwing fatal exception", async () => {
    await notificationService.dispatch({
      userId: "user-marchand-1",
      channel: NotificationChannel.PUSH,
      title: "Alerte livraison",
      body: "Votre colis est en cours de livraison.",
      contact: "token_expired_or_invalid",
    });

    // Worker executes without crashing
    await expect(notificationWorker.processNextJob()).resolves.toBe(true);

    const saved = notificationsRecord[0];
    expect(saved.status).toBe(NotificationStatus.FAILED);
    expect(saved.lastError).toBe("DeviceTokenNotRegistered");
  });

  it("Mark as Read: Allows user to mark individual and all notifications as read", async () => {
    const n1 = await notificationService.dispatch({
      userId: "user-test",
      channel: NotificationChannel.IN_APP,
      title: "Bienvenue",
      body: "Bienvenue sur HES Logistics",
    });

    await notificationService.markAsRead(n1.id, "user-test");
    const updated = notificationsRecord.find((n) => n.id === n1.id);
    expect(updated.status).toBe(NotificationStatus.READ);
    expect(updated.readAt).toBeDefined();
  });

  it("Domain Event Consumer: Reacts to DeliveryCompletedEvent and dispatches notification without direct coupling", async () => {
    const { EventBusService } = await import(
      "../src/common/events/event-bus.service"
    );
    const { DeliveryCompletedEvent } = await import(
      "../src/common/events/delivery.events"
    );
    const { NotificationEventSubscriber } = await import(
      "../src/modules/notifications/application/subscribers/notification-event.subscriber"
    );

    const eventBus = new EventBusService();
    const subscriber = new NotificationEventSubscriber(
      eventBus,
      mockPrisma,
      notificationService,
    );
    subscriber.onModuleInit();

    await eventBus.publish(
      new DeliveryCompletedEvent({
        deliveryAttemptId: "att-1",
        parcelId: "parc-1",
        shipmentId: "ship-1",
        trackingNumber: "HES-CAS-2026-0001",
        courierId: "cour-1",
        courierUserId: "user-cour-1",
        agencyId: "ag-cas",
        recipientName: "M. Idrissi",
        proofType: "DIGITAL_SIGNATURE" as any,
        isDeferredScan: false,
        registeredByUserId: "user-cour-1",
        deliveredAt: new Date(),
        globalShipmentStatus: "DELIVERED" as any,
      }),
    );

    const notif = notificationsRecord.find((n) =>
      n.title.includes("HES-CAS-2026-0001"),
    );
    expect(notif).toBeDefined();
    expect(notif.userId).toBe("user-cust-1");
    expect(notif.channel).toBe(NotificationChannel.PUSH);
    expect(notif.body).toContain("M. Idrissi");
  });

  it("Domain Event Consumer: Reacts to TransferCreatedEvent and dispatches in-app notification to destination agency", async () => {
    const { EventBusService } = await import(
      "../src/common/events/event-bus.service"
    );
    const { TransferCreatedEvent } = await import(
      "../src/common/events/transfer.events"
    );
    const { NotificationEventSubscriber } = await import(
      "../src/modules/notifications/application/subscribers/notification-event.subscriber"
    );

    const eventBus = new EventBusService();
    const subscriber = new NotificationEventSubscriber(
      eventBus,
      mockPrisma,
      notificationService,
    );
    subscriber.onModuleInit();

    await eventBus.publish(
      new TransferCreatedEvent({
        transferId: "trf-1",
        transferNumber: "TRF-CAS-TNG-2026-001",
        originAgencyId: "ag-cas",
        destinationAgencyId: "ag-tng",
        totalExpectedParcels: 15,
        parcelIds: ["p1", "p2"],
        createdByUserId: "user-dispatcher",
      }),
    );

    const notif = notificationsRecord.find((n) =>
      n.title.includes("TRF-CAS-TNG-2026-001"),
    );
    expect(notif).toBeDefined();
    expect(notif.userId).toBe("user-agent-tng");
    expect(notif.channel).toBe(NotificationChannel.IN_APP);
    expect(notif.body).toContain("15 colis");
  });

  it("Retry after failure: Re-enqueues job with incremented retryCount and backoff on transient failure", async () => {
    let attempts = 0;
    const transientFailingProvider = {
      supports: (channel: NotificationChannel) =>
        channel === NotificationChannel.EMAIL,
      send: jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return { success: false, error: "SMTP Connection Timeout" };
        }
        return { success: true, providerMessageId: "smtp-retry-ok" };
      }),
    };

    const workerWithRetry = new NotificationWorker(
      mockPrisma,
      queueService,
      pushProvider,
      transientFailingProvider as any,
      whatsappProvider,
    );

    await notificationService.dispatch({
      userId: "user-test-retry",
      channel: NotificationChannel.EMAIL,
      title: "Facture mensuelle",
      body: "Votre facture est prête.",
      contact: "test@client.ma",
    });

    // 1st attempt: fails, increments retryCount to 1, and re-enqueues
    const step1 = await workerWithRetry.processNextJob();
    expect(step1).toBe(true);
    expect(notificationsRecord[0].retryCount).toBe(1);
    expect(redisQueue).toHaveLength(1);

    // 2nd attempt: succeeds, status transitions to SENT
    const step2 = await workerWithRetry.processNextJob();
    expect(step2).toBe(true);
    expect(notificationsRecord[0].status).toBe(NotificationStatus.SENT);
  });
});
