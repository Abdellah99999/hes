import { Injectable, Logger } from "@nestjs/common";
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  NotificationSendResult,
} from "../domain/notification.types";

@Injectable()
export class EmailNotificationProvider implements INotificationProvider {
  private readonly logger = new Logger(EmailNotificationProvider.name);

  supports(channel: NotificationChannel): boolean {
    return channel === NotificationChannel.EMAIL;
  }

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    const email = payload.recipientContact;
    if (!email || !email.includes("@")) {
      return {
        success: false,
        error: "Adresse email invalide ou manquante",
      };
    }

    this.logger.log(
      `[EMAIL DISPATCHED] To: ${email} | Subject: "${payload.title}"`,
    );
    return {
      success: true,
      providerMessageId: `smtp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
  }
}
