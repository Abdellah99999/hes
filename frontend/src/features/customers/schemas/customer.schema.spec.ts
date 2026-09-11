import { describe, it, expect } from "vitest";
import {
  customerSchema,
  assignManagerSchema,
  customerContactSchema,
} from "./customer.schema";

describe("Phase 3 Frontend Tests: Form Validation & Zod Schemas", () => {
  describe("Customer Schema Validation (ICE, Code, Required Fields)", () => {
    it("should ACCEPT a completely valid customer payload with Moroccan ICE", () => {
      const validPayload = {
        customerTypeId: "type-b2b-uuid-1",
        code: "CLI-AGA-001",
        legalName: "Souss Logistique SARL",
        tradeName: "Souss Express",
        ice: "001234567890123", // 15 digits
        taxId: "87654321",
        email: "contact@sousslog.ma",
        phone: "+212528112233",
        status: "ACTIVE" as const,
        notes: "Client prioritaire",
      };

      const result = customerSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should REJECT customer data if Moroccan ICE is not exactly 15 digits", () => {
      const invalidIcePayload = {
        customerTypeId: "type-b2b-uuid-1",
        code: "CLI-AGA-002",
        legalName: "Invalide ICE SARL",
        ice: "12345", // Only 5 digits
        status: "ACTIVE" as const,
      };

      const result = customerSchema.safeParse(invalidIcePayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const iceError = result.error.errors.find((e) => e.path.includes("ice"));
        expect(iceError).toBeDefined();
        expect(iceError?.message).toContain("15 chiffres");
      }
    });

    it("should REJECT customer data if code contains lowercase or invalid symbols", () => {
      const invalidCodePayload = {
        customerTypeId: "type-b2b-uuid-1",
        code: "cli_lowercase_bad$",
        legalName: "Invalid Code SARL",
        status: "ACTIVE" as const,
      };

      const result = customerSchema.safeParse(invalidCodePayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const codeError = result.error.errors.find((e) => e.path.includes("code"));
        expect(codeError).toBeDefined();
        expect(codeError?.message).toContain("majuscules");
      }
    });

    it("should REJECT customer data if legalName or customerTypeId is missing", () => {
      const missingFieldsPayload = {
        code: "CLI-AGA-003",
        status: "ACTIVE" as const,
      };

      const result = customerSchema.safeParse(missingFieldsPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.errors.map((e) => e.path[0]);
        expect(fields).toContain("legalName");
        expect(fields).toContain("customerTypeId");
      }
    });

    it("should REJECT invalid email formats", () => {
      const invalidEmailPayload = {
        customerTypeId: "type-b2b-uuid-1",
        code: "CLI-AGA-004",
        legalName: "Bad Email SARL",
        email: "not-a-valid-email",
        status: "ACTIVE" as const,
      };

      const result = customerSchema.safeParse(invalidEmailPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.errors.find((e) => e.path.includes("email"));
        expect(emailError).toBeDefined();
      }
    });
  });

  describe("Assign Manager Schema Validation", () => {
    it("should REJECT empty manager assignment or short reason", () => {
      const invalidAssign = {
        userId: "",
        assignmentReason: "No", // Less than 3 chars
      };

      const result = assignManagerSchema.safeParse(invalidAssign);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map((e) => e.path[0]);
        expect(paths).toContain("userId");
        expect(paths).toContain("assignmentReason");
      }
    });

    it("should ACCEPT valid manager reassignment with justified reason", () => {
      const validAssign = {
        userId: "user-uuid-12345",
        assignmentReason: "Mutation de portefeuille client vers l'agence Agadir",
      };

      const result = assignManagerSchema.safeParse(validAssign);
      expect(result.success).toBe(true);
    });
  });

  describe("Customer Contact Schema Validation", () => {
    it("should validate customer contacts properly", () => {
      const validContact = {
        customerId: "cust-uuid-1",
        firstName: "Karim",
        lastName: "Bennani",
        email: "k.bennani@client.ma",
        roleTitle: "Directeur Achats",
        isPrimary: true,
      };

      const result = customerContactSchema.safeParse(validContact);
      expect(result.success).toBe(true);
    });
  });
});
