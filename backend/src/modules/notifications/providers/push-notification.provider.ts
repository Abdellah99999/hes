import { Injectable, Logger } from "@nestjs/common";
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  NotificationSendResult,
} from "../domain/notification.types";

@Injectable()
export class PushNotificationProvider implements INotificationProvider {
  private readonly logger = new Logger(PushNotificationProvider.name);

  supports(channel: NotificationChannel): boolean {
    return channel === NotificationChannel.PUSH;
  }

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    const contact = payload.recipientContact || "";

    // 1. Security check: Ensure no precise currency amount in push body
    if (/\d+([.,]\d{2})?\s*(MAD|DIRHAM|EUR|\$)/i.test(payload.body)) {
      this.logger.warn(
        `[CYBERSECURITY ALERT] Precise financial amount detected in push payload for user ${payload.recipientUserId}. Scrubbing content before sending.`,
      );
      payload.body = payload.body.replace(
        /\d+([.,]\d{2})?\s*(MAD|DIRHAM|EUR|\$)/gi,
        "[Information Sécurisée]",
      );
    }

    // 2. Simulate push delivery with tolerant invalid-token handling
    if (
      contact === "token_expired_or_invalid" ||
      contact.startsWith("invalid_")
    ) {
      this.logger.warn(
        `Push token invalid or expired for user ${payload.recipientUserId}. Purging silently without throwing fatal error.`,
      );
      return {
        success: false,
        error: "DeviceTokenNotRegistered",
        isTokenInvalid: true,
      };
    }

    this.logger.log(
      `[PUSH SENT] To User ${payload.recipientUserId}: "${payload.title}" - "${payload.body}"`,
    );
    return {
      success: true,
      providerMessageId: `fcm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
  }
}
