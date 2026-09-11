import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";
import { ShipmentStatus } from "@prisma/client";

export interface ShipmentRegisteredPayload {
  shipmentId: string;
  trackingNumber: string;
  originAgencyId: string;
  destinationAgencyId?: string | null;
  senderCustomerId?: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientCity?: string | null;
  totalParcels: number;
  codAmount?: number | null;
  status: ShipmentStatus;
  createdById: string;
  registeredAt: Date;
}

export class ShipmentRegisteredEvent
  implements DomainEvent<ShipmentRegisteredPayload>
{
  readonly eventId: string;
  readonly eventName = "ShipmentRegistered";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: ShipmentRegisteredPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}
