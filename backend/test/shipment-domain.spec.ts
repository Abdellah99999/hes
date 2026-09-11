import { BadRequestException } from "@nestjs/common";
import { ParcelStatus, ShipmentStatus } from "@prisma/client";
import { computeGlobalShipmentStatus } from "../src/modules/shipments/domain/shipment-status.calculator";
import {
  validateParcelTransition,
  ALLOWED_PARCEL_TRANSITIONS,
} from "../src/modules/shipments/domain/parcel-state-machine";

describe("Phase 4: Shipment Domain Logic & Parcel State Machine Tests", () => {
  describe("computeGlobalShipmentStatus (Pure Deterministic Function)", () => {
    it("should return DRAFT when parcels array is empty or undefined", () => {
      expect(computeGlobalShipmentStatus([])).toBe(ShipmentStatus.DRAFT);
      expect(
        computeGlobalShipmentStatus(null as unknown as ParcelStatus[]),
      ).toBe(ShipmentStatus.DRAFT);
    });

    it("should return REGISTERED when 100% of parcels are REGISTERED", () => {
      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.REGISTERED,
          ParcelStatus.REGISTERED,
          ParcelStatus.REGISTERED,
        ]),
      ).toBe(ShipmentStatus.REGISTERED);
    });

    it("should return CANCELLED when 100% of parcels are CANCELLED", () => {
      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.CANCELLED,
          ParcelStatus.CANCELLED,
        ]),
      ).toBe(ShipmentStatus.CANCELLED);
    });

    it("should return DELIVERED when 100% of parcels are DELIVERED", () => {
      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.DELIVERED,
          ParcelStatus.DELIVERED,
        ]),
      ).toBe(ShipmentStatus.DELIVERED);
    });

    it("should return PARTIALLY_DELIVERED when some parcels are DELIVERED and others are still pending or failed", () => {
      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.DELIVERED,
          ParcelStatus.IN_TRANSIT,
        ]),
      ).toBe(ShipmentStatus.PARTIALLY_DELIVERED);

      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.DELIVERED,
          ParcelStatus.RETURNED,
        ]),
      ).toBe(ShipmentStatus.PARTIALLY_DELIVERED);

      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.DELIVERED,
          ParcelStatus.DELIVERY_FAILED,
        ]),
      ).toBe(ShipmentStatus.PARTIALLY_DELIVERED);
    });

    it("should return RETURNED when all non-cancelled parcels are RETURNED", () => {
      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED,
        ]),
      ).toBe(ShipmentStatus.RETURNED);

      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.RETURNED,
          ParcelStatus.CANCELLED,
        ]),
      ).toBe(ShipmentStatus.RETURNED);
    });

    it("should return OUT_FOR_DELIVERY when at least one parcel is out for delivery and none delivered yet", () => {
      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.OUT_FOR_DELIVERY,
          ParcelStatus.AT_HUB,
        ]),
      ).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
    });

    it("should return IN_TRANSIT for active transit intermediate states", () => {
      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.PICKED_UP,
          ParcelStatus.REGISTERED,
        ]),
      ).toBe(ShipmentStatus.IN_TRANSIT);

      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.AT_HUB,
          ParcelStatus.IN_TRANSIT,
        ]),
      ).toBe(ShipmentStatus.IN_TRANSIT);

      expect(
        computeGlobalShipmentStatus([
          ParcelStatus.DELIVERY_FAILED,
          ParcelStatus.AT_HUB,
        ]),
      ).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it("should return EXCEPTION when all parcels are either LOST or DAMAGED", () => {
      expect(
        computeGlobalShipmentStatus([ParcelStatus.LOST, ParcelStatus.DAMAGED]),
      ).toBe(ShipmentStatus.EXCEPTION);

      expect(
        computeGlobalShipmentStatus([ParcelStatus.LOST, ParcelStatus.LOST]),
      ).toBe(ShipmentStatus.EXCEPTION);
    });
  });

  describe("validateParcelTransition (Parcel State Machine)", () => {
    it("should allow transition to the same status (idempotency)", () => {
      expect(() => {
        validateParcelTransition(
          ParcelStatus.REGISTERED,
          ParcelStatus.REGISTERED,
        );
        validateParcelTransition(
          ParcelStatus.IN_TRANSIT,
          ParcelStatus.IN_TRANSIT,
        );
      }).not.toThrow();
    });

    it("should allow valid standard lifecycle transitions", () => {
      // REGISTERED -> PICKED_UP
      expect(() =>
        validateParcelTransition(
          ParcelStatus.REGISTERED,
          ParcelStatus.PICKED_UP,
        ),
      ).not.toThrow();

      // PICKED_UP -> IN_TRANSIT
      expect(() =>
        validateParcelTransition(
          ParcelStatus.PICKED_UP,
          ParcelStatus.IN_TRANSIT,
        ),
      ).not.toThrow();

      // IN_TRANSIT -> AT_HUB
      expect(() =>
        validateParcelTransition(ParcelStatus.IN_TRANSIT, ParcelStatus.AT_HUB),
      ).not.toThrow();

      // AT_HUB -> OUT_FOR_DELIVERY
      expect(() =>
        validateParcelTransition(
          ParcelStatus.AT_HUB,
          ParcelStatus.OUT_FOR_DELIVERY,
        ),
      ).not.toThrow();

      // OUT_FOR_DELIVERY -> DELIVERED
      expect(() =>
        validateParcelTransition(
          ParcelStatus.OUT_FOR_DELIVERY,
          ParcelStatus.DELIVERED,
        ),
      ).not.toThrow();
    });

    it("should allow failure and recovery loops", () => {
      // OUT_FOR_DELIVERY -> DELIVERY_FAILED
      expect(() =>
        validateParcelTransition(
          ParcelStatus.OUT_FOR_DELIVERY,
          ParcelStatus.DELIVERY_FAILED,
        ),
      ).not.toThrow();

      // DELIVERY_FAILED -> AT_HUB (back to hub for re-attempt)
      expect(() =>
        validateParcelTransition(
          ParcelStatus.DELIVERY_FAILED,
          ParcelStatus.AT_HUB,
        ),
      ).not.toThrow();

      // DELIVERY_FAILED -> OUT_FOR_DELIVERY (second attempt)
      expect(() =>
        validateParcelTransition(
          ParcelStatus.DELIVERY_FAILED,
          ParcelStatus.OUT_FOR_DELIVERY,
        ),
      ).not.toThrow();

      // DELIVERY_FAILED -> RETURNED (returned to sender after max attempts)
      expect(() =>
        validateParcelTransition(
          ParcelStatus.DELIVERY_FAILED,
          ParcelStatus.RETURNED,
        ),
      ).not.toThrow();
    });

    it("should reject terminal state outgoing transitions", () => {
      const terminalStates = [
        ParcelStatus.DELIVERED,
        ParcelStatus.RETURNED,
        ParcelStatus.CANCELLED,
        ParcelStatus.LOST,
        ParcelStatus.DAMAGED,
      ];

      for (const terminal of terminalStates) {
        expect(ALLOWED_PARCEL_TRANSITIONS[terminal]).toEqual([]);
        expect(() =>
          validateParcelTransition(terminal, ParcelStatus.IN_TRANSIT),
        ).toThrow(BadRequestException);
      }
    });

    it("should reject illegal skipping transitions with clear French error message", () => {
      // Direct jump from REGISTERED to DELIVERED without transit
      expect(() =>
        validateParcelTransition(
          ParcelStatus.REGISTERED,
          ParcelStatus.DELIVERED,
        ),
      ).toThrow(BadRequestException);

      try {
        validateParcelTransition(
          ParcelStatus.REGISTERED,
          ParcelStatus.DELIVERED,
        );
      } catch (err: unknown) {
        const error = err as Error;
        expect(error.message).toContain("Transition d'état interdite");
        expect(error.message).toContain("REGISTERED");
        expect(error.message).toContain("DELIVERED");
      }

      // Direct jump from CANCELLED to PICKED_UP
      expect(() =>
        validateParcelTransition(
          ParcelStatus.CANCELLED,
          ParcelStatus.PICKED_UP,
        ),
      ).toThrow(BadRequestException);
    });
  });
});
