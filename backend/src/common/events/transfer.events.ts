import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";

export interface TransferCreatedPayload {
  transferId: string;
  transferNumber: string;
  originAgencyId: string;
  destinationAgencyId: string;
  totalExpectedParcels: number;
  parcelIds: string[];
  createdByUserId: string;
}

export interface TransferReceivedPayload {
  transferId: string;
  transferNumber: string;
  originAgencyId: string;
  destinationAgencyId: string;
  receivedByUserId: string;
  receivedCount: number;
  missingCount: number;
  hasDiscrepancy: boolean;
  missingParcelIds: string[];
}

export class TransferCreatedEvent
  implements DomainEvent<TransferCreatedPayload>
{
  readonly eventId: string;
  readonly eventName = "TransferCreated";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: TransferCreatedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}

export class TransferReceivedEvent
  implements DomainEvent<TransferReceivedPayload>
{
  readonly eventId: string;
  readonly eventName = "TransferReceived";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: TransferReceivedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}
