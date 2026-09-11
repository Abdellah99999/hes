import { describe, it, expect } from "vitest";
import {
  TRACKING_NUMBER_REGEX,
  manualStatusChangeSchema,
} from "./tracking.schema";

describe("Phase 5 Frontend Tests: Tracking Schemas & Validation Rules", () => {
  describe("TRACKING_NUMBER_REGEX", () => {
    it("should accept valid standard shipment tracking numbers", () => {
      expect(TRACKING_NUMBER_REGEX.test("HES-CAS-2026-000042")).toBe(true);
      expect(TRACKING_NUMBER_REGEX.test("HES-TNG-2025-000100")).toBe(true);
      expect(TRACKING_NUMBER_REGEX.test("HES-RAK-2026-999999")).toBe(true);
    });

    it("should accept valid individual parcel tracking numbers (with -PP suffix)", () => {
      expect(TRACKING_NUMBER_REGEX.test("HES-CAS-2026-000042-01")).toBe(true);
      expect(TRACKING_NUMBER_REGEX.test("HES-CAS-2026-000042-12")).toBe(true);
      expect(TRACKING_NUMBER_REGEX.test("HES-AGA-2026-000001-99")).toBe(true);
    });

    it("should accept valid UUIDs", () => {
      expect(
        TRACKING_NUMBER_REGEX.test("123e4567-e89b-12d3-a456-426614174000"),
      ).toBe(true);
    });

    it("should reject malformed tracking numbers", () => {
      expect(TRACKING_NUMBER_REGEX.test("")).toBe(false);
      expect(TRACKING_NUMBER_REGEX.test("INVALID")).toBe(false);
      expect(TRACKING_NUMBER_REGEX.test("HES-CAS-26-000042")).toBe(false); // 2-digit year
      expect(TRACKING_NUMBER_REGEX.test("HES-CAS-2026-42")).toBe(false); // short sequence
      expect(TRACKING_NUMBER_REGEX.test("FEDEX-123456789")).toBe(false);
    });
  });

  describe("manualStatusChangeSchema (Strict Audit Trail)", () => {
    it("should accept valid manual change with comment >= 5 characters", () => {
      const valid = {
        trackingNumberOrId: "HES-CAS-2026-000042-01",
        status: "AT_HUB",
        notes: "Réception quai Casablanca suite transfert",
      };

      const result = manualStatusChangeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should REJECT manual change if notes comment is less than 5 characters", () => {
      const invalid = {
        trackingNumberOrId: "HES-CAS-2026-000042-01",
        status: "AT_HUB",
        notes: "OK", // Only 2 chars
      };

      const result = manualStatusChangeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "au moins 5 caractères",
        );
      }
    });

    it("should REJECT manual change if tracking number format is invalid", () => {
      const invalid = {
        trackingNumberOrId: "MALFORMED_NUM",
        status: "AT_HUB",
        notes: "Commentaire valide avec assez de caractères",
      };

      const result = manualStatusChangeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "Format de numéro de tracking invalide",
        );
      }
    });
  });
});
