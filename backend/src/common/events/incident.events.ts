import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";
import { IncidentType, IncidentSeverity, ParcelStatus } from "@prisma/client";

export interface IncidentCreatedPayload {
  incidentId: string;
  incidentNumber: string;
  shipmentId: string;
  parcelId: string | null;
  agencyId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  claimedAmount: number | null;
  createdByUserId: string | null;
  isDeliveredDispute: boolean;
  lastKnownStatus: ParcelStatus | null;
  lastKnownAgencyId: string | null;
  createdAt: Date;
}

export class IncidentCreatedEvent implements DomainEvent<IncidentCreatedPayload> {
  readonly eventId: string;
  readonly eventName = "IncidentCreated";
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: IncidentCreatedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}

