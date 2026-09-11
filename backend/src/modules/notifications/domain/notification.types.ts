import { NotificationChannel, NotificationStatus } from "@prisma/client";

export { NotificationChannel, NotificationStatus };

export interface NotificationPayload {
  notificationId?: string;
  recipientUserId: string;
  recipientContact?: string; // Token push, email ou numéro mobile
  title: string;
  body: string;
  channel: NotificationChannel;
  metadata?: Record<string, unknown>;
  retryCount?: number;
}

export interface NotificationSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  isTokenInvalid?: boolean; // Signal spécifique pour token push révoqué sans faire planter le flux
}

export interface INotificationProvider {
  supports(channel: NotificationChannel): boolean;
  send(payload: NotificationPayload): Promise<NotificationSendResult>;
}
