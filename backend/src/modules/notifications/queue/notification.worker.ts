import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationQueueService } from "./notification-queue.service";
import {
  INotificationProvider,
  NotificationPayload,
  NotificationStatus,
} from "../domain/notification.types";
import { PushNotificationProvider } from "../providers/push-notification.provider";
import { EmailNotificationProvider } from "../providers/email-notification.provider";
import { WhatsappSmsProviderStub } from "../providers/whatsapp-sms.provider.stub";
import { requestContextStorage } from "../../../common/context/request-context.storage";

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private readonly providers: INotificationProvider[];
  private readonly maxRetries = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: NotificationQueueService,
    pushProvider: PushNotificationProvider,
    emailProvider: EmailNotificationProvider,
    whatsappProvider: WhatsappSmsProviderStub,
  ) {
    this.providers = [pushProvider, emailProvider, whatsappProvider];
  }

  async processNextJob(): Promise<boolean> {
    const job = await this.queueService.dequeue();
    if (!job) return false;

    await this.handleNotification(job);
    return true;
  }

  async handleNotification(job: NotificationPayload): Promise<void> {
    const correlationId =
      job.correlationId ||
      (job.metadata?.correlationId as string) ||
      (job.metadata?.requestId as string);

    if (correlationId) {
      return requestContextStorage.run({ requestId: correlationId }, () =>
        this.executeNotification(job),
      );
    }
    return this.executeNotification(job);
  }

  private async executeNotification(job: NotificationPayload): Promise<void> {
    const provider = this.providers.find((p) => p.supports(job.channel));

    if (!provider) {
      this.logger.warn(`No provider registered for channel ${job.channel}`);
      if (job.notificationId) {
        await this.prisma.notification.update({
          where: { id: job.notificationId },
          data: {
            status: NotificationStatus.FAILED,
            lastError: "Unsupported channel",
            metadata: {
              ...(job.metadata || {}),
              lastError: "Unsupported channel",
            },
          } as unknown as Prisma.NotificationUpdateInput,
        });
      }
      return;
    }

    try {
      const result = await provider.send(job);

      if (result.success) {
        if (job.notificationId) {
          await this.prisma.notification.update({
            where: { id: job.notificationId },
            data: { status: NotificationStatus.SENT, sentAt: new Date() },
          });
        }
      } else {
        await this.handleFailure(
          job,
          result.error || "Unknown provider error",
          result.isTokenInvalid,
        );
      }
    } catch (error) {
      await this.handleFailure(job, (error as Error).message);
    }
  }

  private async handleFailure(
    job: NotificationPayload,
    error: string,
    isTokenInvalid = false,
  ): Promise<void> {
    const currentRetries = (job.retryCount || 0) + 1;

    // If token invalid, don't retry endlessly, mark failed cleanly
    if (isTokenInvalid || currentRetries >= this.maxRetries) {
      this.logger.warn(
        `[NOTIFICATION FAILED PERMANENTLY] Notification ${job.notificationId || "ad-hoc"} failed after ${currentRetries} tries: ${error}`,
      );

      if (job.notificationId) {
        await this.prisma.notification.update({
          where: { id: job.notificationId },
          data: {
            status: NotificationStatus.FAILED,
            retryCount: currentRetries,
            lastError: error,
            metadata: {
              ...(job.metadata || {}),
              retryCount: currentRetries,
              lastError: error,
            },
          } as unknown as Prisma.NotificationUpdateInput,
        });
      }
      return;
    }

    // Exponential backoff retry: re-enqueue with incremented retryCount
    const backoffSeconds = Math.pow(2, currentRetries);
    this.logger.log(
      `[NOTIFICATION RETRY SCHEDULED] Notification ${job.notificationId} failed (${error}). Retrying in ${backoffSeconds}s (attempt ${currentRetries}/${this.maxRetries}).`,
    );

    if (job.notificationId) {
      await this.prisma.notification.update({
        where: { id: job.notificationId },
        data: {
          retryCount: currentRetries,
          lastError: error,
          metadata: {
            ...(job.metadata || {}),
            retryCount: currentRetries,
            lastError: error,
          },
        } as unknown as Prisma.NotificationUpdateInput,
      });
    }

    // Re-enqueue for asynchronous retry
    job.retryCount = currentRetries;
    await this.queueService.enqueue(job);
  }
}
