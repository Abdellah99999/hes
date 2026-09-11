import { ParcelStatus } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";

/**
 * Allowed state transitions table for ParcelStatus.
 * Terminal states (DELIVERED, RETURNED, CANCELLED, LOST, DAMAGED) have no outgoing transitions.
 */
export const ALLOWED_PARCEL_TRANSITIONS: Partial<
  Record<ParcelStatus, readonly ParcelStatus[]>
> = {
  [ParcelStatus.CREATED]: [
    ParcelStatus.WAITING_FOR_COLLECTION,
    ParcelStatus.PICKED_UP,
    ParcelStatus.CANCELLED,
  ],
  [ParcelStatus.WAITING_FOR_COLLECTION]: [
    ParcelStatus.PICKED_UP,
    ParcelStatus.COLLECTED,
    ParcelStatus.CANCELLED,
  ],
  [ParcelStatus.COLLECTED]: [
    ParcelStatus.ARRIVED_AGENCY,
    ParcelStatus.AT_HUB,
    ParcelStatus.IN_TRANSIT,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.ARRIVED_AGENCY]: [
    ParcelStatus.IN_TRANSIT,
    ParcelStatus.ASSIGNED_TO_COURIER,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.ARRIVED_DESTINATION_AGENCY]: [
    ParcelStatus.ASSIGNED_TO_COURIER,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.ASSIGNED_TO_COURIER]: [
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.ARRIVED_DESTINATION_AGENCY,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.REGISTERED]: [ParcelStatus.PICKED_UP, ParcelStatus.CANCELLED],
  [ParcelStatus.PICKED_UP]: [
    ParcelStatus.IN_TRANSIT,
    ParcelStatus.AT_HUB,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.IN_TRANSIT]: [
    ParcelStatus.AT_HUB,
    ParcelStatus.ARRIVED_DESTINATION_AGENCY,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.AT_HUB]: [
    ParcelStatus.IN_TRANSIT,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.RETURNED,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.OUT_FOR_DELIVERY]: [
    ParcelStatus.DELIVERED,
    ParcelStatus.PARTIALLY_DELIVERED,
    ParcelStatus.DELIVERY_FAILED,
    ParcelStatus.RECIPIENT_ABSENT,
    ParcelStatus.REFUSED,
    ParcelStatus.ADDRESS_INCORRECT,
    ParcelStatus.DELAYED,
    ParcelStatus.RETURNED,
    ParcelStatus.LOST,
    ParcelStatus.DAMAGED,
  ],
  [ParcelStatus.DELIVERY_FAILED]: [
    ParcelStatus.AT_HUB,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.RETURNED,
  ],
  [ParcelStatus.RECIPIENT_ABSENT]: [
    ParcelStatus.AT_HUB,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.RETURNED,
  ],
  [ParcelStatus.REFUSED]: [ParcelStatus.AT_HUB, ParcelStatus.RETURNED],
  [ParcelStatus.ADDRESS_INCORRECT]: [
    ParcelStatus.AT_HUB,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.RETURNED,
  ],
  [ParcelStatus.DELAYED]: [ParcelStatus.OUT_FOR_DELIVERY, ParcelStatus.AT_HUB],
  [ParcelStatus.PARTIALLY_DELIVERED]: [ParcelStatus.RETURNED],
  [ParcelStatus.DELIVERED]: [],
  [ParcelStatus.RETURNED]: [],
  [ParcelStatus.CANCELLED]: [],
  [ParcelStatus.LOST]: [],
  [ParcelStatus.DAMAGED]: [],
};

/**
 * Validates whether a state transition from `currentStatus` to `newStatus` is legally permitted.
 * Throws a BadRequestException if the transition is invalid.
 */
export function validateParcelTransition(
  currentStatus: ParcelStatus,
  newStatus: ParcelStatus,
): void {
  if (currentStatus === newStatus) {
    return;
  }

  const allowed = ALLOWED_PARCEL_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new BadRequestException(
      `Transition d'état interdite : impossible de passer le colis de '${currentStatus}' à '${newStatus}'.`,
    );
  }
}
