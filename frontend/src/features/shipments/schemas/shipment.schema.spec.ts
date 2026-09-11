import { describe, it, expect } from "vitest";
import {
  createShipmentSchema,
  step1Schema,
  step2Schema,
  step3Schema,
  parcelSchema,
} from "./shipment.schema";

describe("Phase 4 Frontend Tests: Shipment & Multi-Parcel Zod Schemas", () => {
  describe("Step 1: Expéditeur & Destinataire Schema", () => {
    it("should ACCEPT a valid step 1 payload", () => {
      const valid = {
        senderCustomerId: "cust-uuid-1",
        destinationAgencyId: "agency-uuid-2",
        recipientName: "Youssef Alaoui",
        recipientPhone: "+212661001122",
        recipientAddress: "123 Rue de la Liberté",
        recipientCity: "Casablanca",
        recipientEmail: "youssef@example.ma",
      };

      const result = step1Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should REJECT if required fields are missing", () => {
      const invalid = {
        senderCustomerId: "",
        recipientName: "",
        recipientPhone: "",
        recipientAddress: "",
        recipientCity: "",
      };

      const result = step1Schema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map((e) => e.path[0]);
        expect(paths).toContain("senderCustomerId");
        expect(paths).toContain("destinationAgencyId");
        expect(paths).toContain("recipientName");
        expect(paths).toContain("recipientPhone");
        expect(paths).toContain("recipientAddress");
        expect(paths).toContain("recipientCity");
      }
    });
  });

  describe("Step 2: Parcels & Multi-Colis Schema", () => {
    it("should REJECT if parcels list is empty", () => {
      const emptyParcels = {
        parcels: [],
      };

      const result = step2Schema.safeParse(emptyParcels);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("au moins un colis");
      }
    });

    it("should REJECT if parcel weight is zero or negative", () => {
      const invalidWeight = {
        parcelTypeId: "type-carton-std",
        weightKg: 0,
      };

      const result = parcelSchema.safeParse(invalidWeight);
      expect(result.success).toBe(false);
      if (!result.success) {
        const weightErr = result.error.errors.find((e) => e.path.includes("weightKg"));
        expect(weightErr).toBeDefined();
        expect(weightErr?.message).toContain("strictement supérieur à 0");
      }
    });

    it("should ACCEPT a valid parcel with dimensions and items", () => {
      const validParcel = {
        parcelTypeId: "type-carton-std",
        weightKg: 3.5,
        lengthCm: 30,
        widthCm: 25,
        heightCm: 20,
        notes: "Matériel fragile",
        items: [
          {
            description: "Capteurs industriels",
            quantity: 4,
            declaredValue: 1200,
          },
        ],
      };

      const result = parcelSchema.safeParse(validParcel);
      expect(result.success).toBe(true);
    });
  });

  describe("Step 3: Service & Payment Schema", () => {
    it("should ACCEPT valid service and financial terms", () => {
      const validStep3 = {
        serviceType: "EXPRESS" as const,
        paymentMethod: "CASH_ON_DELIVERY_COD" as const,
        shippingFee: 85.0,
        declaredValue: 2000,
        codAmount: 550,
      };

      const result = step3Schema.safeParse(validStep3);
      expect(result.success).toBe(true);
    });

    it("should REJECT negative shipping fees or negative COD amounts", () => {
      const invalidFees = {
        serviceType: "STANDARD" as const,
        paymentMethod: "PREPAID_CASH" as const,
        shippingFee: -10,
        codAmount: -50,
      };

      const result = step3Schema.safeParse(invalidFees);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map((e) => e.path[0]);
        expect(paths).toContain("shippingFee");
        expect(paths).toContain("codAmount");
      }
    });
  });

  describe("Complete End-to-End Creation Schema", () => {
    it("should ACCEPT a complete valid multi-parcel shipment payload", () => {
      const completePayload = {
        senderCustomerId: "cust-1",
        destinationAgencyId: "agency-2",
        recipientName: "Ahmed Tazi",
        recipientPhone: "+212612345678",
        recipientAddress: "Bd d'Anfa",
        recipientCity: "Casablanca",
        serviceType: "STANDARD" as const,
        paymentMethod: "PREPAID_CASH" as const,
        shippingFee: 50,
        parcels: [
          {
            parcelTypeId: "type-1",
            weightKg: 2,
            lengthCm: 20,
            widthCm: 15,
            heightCm: 10,
          },
          {
            parcelTypeId: "type-2",
            weightKg: 5,
            lengthCm: 40,
            widthCm: 30,
            heightCm: 25,
          },
        ],
      };

      const result = createShipmentSchema.safeParse(completePayload);
      expect(result.success).toBe(true);
    });
  });
});
