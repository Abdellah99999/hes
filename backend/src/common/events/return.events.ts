import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";
import { ReturnType } from "@prisma/client";

export interface ReturnCreatedPayload {
  returnId: string;
  returnNumber: string;
  shipmentId: string;
  originAgencyId: string;
  destinationAgencyId?: string | null;
  parcelIds: string[];
  returnType: ReturnType;
  reason?: string | null;
  createdByUserId: string;
  assignedCourierId?: string | null;
  createdAt: Date;
}

export class ReturnCreatedEvent
  implements DomainEvent<ReturnCreatedPayload>
{
  readonly eventId: string;
  readonly eventName = "ReturnCreated";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: ReturnCreatedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}
