import { Injectable, Logger } from "@nestjs/common";
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  NotificationSendResult,
} from "../domain/notification.types";

@Injectable()
export class WhatsappSmsProviderStub implements INotificationProvider {
  private readonly logger = new Logger(WhatsappSmsProviderStub.name);

  supports(channel: NotificationChannel): boolean {
    return (
      channel === NotificationChannel.SMS ||
      (channel as any) === "WHATSAPP_SMS"
    );
  }

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    const phone = payload.recipientContact;
    this.logger.log(
      `[WHATSAPP/SMS GATEWAY STUB] To: ${phone || "N/A"} | Body: "${payload.body}"`,
    );
    return {
      success: true,
      providerMessageId: `msg-gw-${Date.now()}`,
    };
  }
}
