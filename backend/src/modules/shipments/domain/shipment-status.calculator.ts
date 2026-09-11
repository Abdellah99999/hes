import { ParcelStatus, ShipmentStatus } from "@prisma/client";

/**
 * Pure domain function to derive the global shipment status from the collection of its parcel statuses.
 * Guarantees mathematical determinism across all multi-parcel delivery lifecycles.
 */
export function computeGlobalShipmentStatus(
  parcelStatuses: ParcelStatus[],
): ShipmentStatus {
  if (!parcelStatuses || parcelStatuses.length === 0) {
    return ShipmentStatus.DRAFT;
  }

  const all = (status: ParcelStatus) =>
    parcelStatuses.every((s) => s === status);
  const any = (status: ParcelStatus) =>
    parcelStatuses.some((s) => s === status);

  // 1. Tous annulés -> Expédition annulée
  if (all(ParcelStatus.CANCELLED)) {
    return ShipmentStatus.CANCELLED;
  }

  // 2. Tous enregistrés (non encore pris en charge physiquement)
  if (all(ParcelStatus.REGISTERED)) {
    return ShipmentStatus.REGISTERED;
  }

  // 3. Tous livrés avec succès -> Expédition entièrement livrée
  if (all(ParcelStatus.DELIVERED)) {
    return ShipmentStatus.DELIVERED;
  }

  // 4. Livraison partielle : Au moins un colis livré, mais d'autres sont retournés, perdus ou encore en cours
  if (any(ParcelStatus.DELIVERED) && !all(ParcelStatus.DELIVERED)) {
    return ShipmentStatus.PARTIALLY_DELIVERED;
  }

  // 5. Tous les colis non annulés sont retournés à l'expéditeur
  const nonCancelled = parcelStatuses.filter(
    (s) => s !== ParcelStatus.CANCELLED,
  );
  if (
    nonCancelled.length > 0 &&
    nonCancelled.every((s) => s === ParcelStatus.RETURNED)
  ) {
    return ShipmentStatus.RETURNED;
  }

  // 6. Au moins un colis est en cours de livraison finale dans le véhicule du livreur
  if (any(ParcelStatus.OUT_FOR_DELIVERY)) {
    return ShipmentStatus.OUT_FOR_DELIVERY;
  }

  // 7. En transit : Au moins un colis est pris en charge, au hub ou en route
  if (
    any(ParcelStatus.IN_TRANSIT) ||
    any(ParcelStatus.AT_HUB) ||
    any(ParcelStatus.PICKED_UP) ||
    any(ParcelStatus.DELIVERY_FAILED)
  ) {
    return ShipmentStatus.IN_TRANSIT;
  }

  // 8. Tous perdus ou détruits (incident critique)
  if (
    parcelStatuses.every(
      (s) => s === ParcelStatus.LOST || s === ParcelStatus.DAMAGED,
    )
  ) {
    return ShipmentStatus.EXCEPTION;
  }

  return ShipmentStatus.IN_TRANSIT;
}
