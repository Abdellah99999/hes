import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";
import {
  ProofType,
  ShipmentStatus,
  AttemptResult,
  RefusalReasonCode,
} from "@prisma/client";

export interface DeliveryCompletedPayload {
  deliveryAttemptId: string;
  parcelId: string;
  shipmentId: string;
  trackingNumber: string;
  courierId: string;
  courierUserId: string;
  agencyId: string;
  recipientName: string;
  recipientCin?: string | null;
  proofType: ProofType;
  podMethod?: string | null;
  collectedCodAmount?: number | null;
  isDeferredScan: boolean;
  registeredByUserId: string;
  deliveredAt: Date;
  globalShipmentStatus: ShipmentStatus;
}

export class DeliveryCompletedEvent
  implements DomainEvent<DeliveryCompletedPayload>
{
  readonly eventId: string;
  readonly eventName = "DeliveryCompleted";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: DeliveryCompletedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}

export interface DeliveryFailedPayload {
  deliveryAttemptId: string;
  parcelId: string;
  shipmentId: string;
  trackingNumber: string;
  courierId: string;
  courierUserId: string;
  agencyId: string;
  attemptResult: AttemptResult;
  refusalReasonCode?: RefusalReasonCode | null;
  isRefusal: boolean;
  triggersReturn: boolean;
  courierNotes?: string | null;
  attemptedAt: Date;
  globalShipmentStatus: ShipmentStatus;
}

export class DeliveryFailedEvent
  implements DomainEvent<DeliveryFailedPayload>
{
  readonly eventId: string;
  readonly eventName = "DeliveryFailed";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: DeliveryFailedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}
