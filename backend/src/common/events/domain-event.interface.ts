export interface DomainEvent<T = unknown> {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly correlationId?: string;
  readonly payload: T;
}
