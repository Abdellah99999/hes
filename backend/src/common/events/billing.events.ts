import { DomainEvent } from "./domain-event.interface";
import { randomUUID } from "crypto";

export interface InvoiceCreatedPayload {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  agencyId: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  dueDate: Date | null;
  createdAt: Date;
}

export class InvoiceCreatedEvent implements DomainEvent<InvoiceCreatedPayload> {
  static readonly EVENT_NAME = "InvoiceCreated";
  readonly eventId: string;
  readonly eventName = InvoiceCreatedEvent.EVENT_NAME;
  readonly occurredAt: Date;
  readonly correlationId?: string;

  constructor(
    public readonly payload: InvoiceCreatedPayload,
    correlationId?: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }
}
