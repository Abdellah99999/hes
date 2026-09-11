import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";

export interface ShipmentAssignedToCourierPayload {
  shipmentId: string;
  parcelId: string;
  trackingNumber: string;
  deliveryRunId: string;
  deliveryRunNumber: string;
  courierId: string; // ID of CourierProfile
  courierUserId: string; // ID User of Courier
  courierName: string;
  agencyId: string;
  zoneId?: string | null;
  isOutOfZone: boolean;
  assignedAt: Date;
  assignedByUserId: string;
}

export class ShipmentAssignedToCourierEvent
  implements DomainEvent<ShipmentAssignedToCourierPayload>
{
  readonly eventId: string;
  readonly eventName = "ShipmentAssignedToCourier";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: ShipmentAssignedToCourierPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}
