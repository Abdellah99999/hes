import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationQueueService } from "../queue/notification-queue.service";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationPayload,
} from "../domain/notification.types";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: NotificationQueueService,
  ) {}

  async dispatch(params: {
    userId: string;
    channel?: NotificationChannel;
    title: string;
    body: string;
    contact?: string;
    metadata?: Record<string, unknown>;
  }) {
    const channel = params.channel || NotificationChannel.IN_APP;

    // 1. Persist notification in database (Non-blocking)
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        channel,
        status:
          channel === NotificationChannel.IN_APP
            ? NotificationStatus.SENT
            : NotificationStatus.PENDING,
        title: params.title.trim(),
        body: params.body.trim(),
        metadata: (params.metadata as object) || {},
        sentAt: channel === NotificationChannel.IN_APP ? new Date() : null,
      },
    });

    // 2. If channel requires external delivery (Push, Email, SMS), queue in Redis
    if (channel !== NotificationChannel.IN_APP) {
      const payload: NotificationPayload = {
        notificationId: notification.id,
        recipientUserId: params.userId,
        recipientContact: params.contact,
        title: params.title,
        body: params.body,
        channel,
        metadata: params.metadata,
        retryCount: 0,
      };

      await this.queueService.enqueue(payload);
    }

    return notification;
  }

  async listUserNotifications(userId: string, status?: NotificationStatus) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, status: { not: NotificationStatus.READ } },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }
}
