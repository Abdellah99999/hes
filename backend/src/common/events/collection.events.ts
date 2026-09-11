import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";

export interface CollectionCompletedPayload {
  collectionId: string;
  collectionNumber: string;
  customerId: string;
  agencyId: string;
  courierId: string;
  generatedShipmentId: string;
  shipmentTrackingNumber: string;
  parcelsCount: number;
  totalActualWeightKg: number;
  completedAt: Date;
}

export class CollectionCompletedEvent
  implements DomainEvent<CollectionCompletedPayload>
{
  readonly eventId: string;
  readonly eventName = "CollectionCompleted";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: CollectionCompletedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}
