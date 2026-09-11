import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationService } from "./application/notification.service";
import { NotificationQueueService } from "./queue/notification-queue.service";
import { NotificationWorker } from "./queue/notification.worker";
import { PushNotificationProvider } from "./providers/push-notification.provider";
import { EmailNotificationProvider } from "./providers/email-notification.provider";
import { WhatsappSmsProviderStub } from "./providers/whatsapp-sms.provider.stub";
import { NotificationEventSubscriber } from "./application/subscribers/notification-event.subscriber";
import { PrismaModule } from "../../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { AuthModule } from "../auth/auth.module";
import { EventBusModule } from "../../common/events/event-bus.module";

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, EventBusModule],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationQueueService,
    NotificationWorker,
    PushNotificationProvider,
    EmailNotificationProvider,
    WhatsappSmsProviderStub,
    NotificationEventSubscriber,
  ],
  exports: [NotificationService, NotificationWorker, NotificationEventSubscriber],
})
export class NotificationsModule {}
