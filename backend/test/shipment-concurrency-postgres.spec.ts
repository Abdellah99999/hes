import { PrismaClient } from "@prisma/client";
import { PrismaShipmentRepository } from "../src/modules/shipments/infrastructure/prisma-shipment.repository";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import {
  CreateShipmentDto,
  ServiceType,
} from "../src/modules/shipments/dto/create-shipment.dto";
import { PaymentMethod } from "@prisma/client";

import { AuditService } from "../src/modules/auth/services/audit.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("P0 - Real PostgreSQL Concurrency Integration Test: 50 Concurrent Shipments", () => {
  let prisma: PrismaClient;
  let shipmentRepo: PrismaShipmentRepository;

  let casaAgencyId: string;
  let rabatAgencyId: string;
  let customerId: string;
  let parcelTypeId: string;
  let agentUser: AuthenticatedUser;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const auditService = new AuditService(prisma as unknown as PrismaService);
    shipmentRepo = new PrismaShipmentRepository(
      prisma as unknown as PrismaService,
      auditService,
    );

    // Retrieve seeded reference data from the real database
    const casaAgency = await prisma.agency.findUniqueOrThrow({
      where: { code: "CAS-HUB" },
    });
    const rabatAgency = await prisma.agency.findUniqueOrThrow({
      where: { code: "RAB-CTR" },
    });
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { code: "CUST-001" },
    });
    const parcelType = await prisma.parcelType.findUniqueOrThrow({
      where: { code: "STANDARD" },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "agent.casa@hes.ma" },
    });

    casaAgencyId = casaAgency.id;
    rabatAgencyId = rabatAgency.id;
    customerId = customer.id;
    parcelTypeId = parcelType.id;

    agentUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "AGENT",
      agencyId: casaAgencyId,
      isActive: true,
      tokenVersion: 1,
      permissions: ["shipments:create", "shipments:read"],
      isGlobalScope: false,
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create 50 concurrent shipments in the same agency with ZERO tracking number collisions on real PostgreSQL", async () => {
    const CONCURRENCY_COUNT = 50;

    // Build 50 distinct creation requests
    const tasks = Array.from({ length: CONCURRENCY_COUNT }, (_, index) => {
      const dto: CreateShipmentDto = {
        originAgencyId: casaAgencyId,
        destinationAgencyId: rabatAgencyId,
        senderCustomerId: customerId,
        recipientName: `Destinataire Test ${index + 1}`,
        recipientPhone: `+212600${String(index + 1).padStart(6, "0")}`,
        recipientAddress: `${index + 1} Rue de la Concurrence`,
        recipientCity: "Rabat",
        serviceType: ServiceType.STANDARD,
        paymentMethod: PaymentMethod.CASH,
        shippingFee: 45.0,
        codAmount: 250.0,
        notes: `Real DB concurrent test #${index + 1}`,
        parcels: [
          {
            parcelTypeId,
            weightKg: 1.5,
            lengthCm: 20,
            widthCm: 15,
            heightCm: 10,
            notes: `Colis concurrent ${index + 1}`,
          },
        ],
      };

      return shipmentRepo.create(dto, agentUser);
    });

    // Execute all 50 creations concurrently against PostgreSQL
    const startTime = Date.now();
    const results = await Promise.all(tasks);
    const elapsedMs = Date.now() - startTime;

    console.log(
      `⚡ Created ${CONCURRENCY_COUNT} shipments concurrently on real PostgreSQL in ${elapsedMs}ms (${(
        elapsedMs / CONCURRENCY_COUNT
      ).toFixed(1)}ms/shipment)`,
    );

    // 1. Assert all 50 creations succeeded
    expect(results).toHaveLength(CONCURRENCY_COUNT);

    // 2. Collect all tracking numbers and parcel tracking numbers
    const trackingNumbers = results.map((s) => s.trackingNumber);
    const parcelTrackingNumbers = results.flatMap((s) =>
      s.parcels.map((p) => p.trackingNumber),
    );

    // 3. ZERO duplicate tracking numbers (100% uniqueness guarantee)
    const uniqueTrackingNumbers = new Set(trackingNumbers);
    expect(uniqueTrackingNumbers.size).toBe(CONCURRENCY_COUNT);

    const uniqueParcelNumbers = new Set(parcelTrackingNumbers);
    expect(uniqueParcelNumbers.size).toBe(CONCURRENCY_COUNT);

    // 4. Verify sequence integrity in real PostgreSQL
    const currentYear = new Date().getFullYear();
    const sequenceRecord = await prisma.shipmentSequence.findUnique({
      where: {
        agencyId_year: {
          agencyId: casaAgencyId,
          year: currentYear,
        },
      },
    });

    expect(sequenceRecord).not.toBeNull();
    expect(sequenceRecord!.currentValue).toBeGreaterThanOrEqual(
      CONCURRENCY_COUNT,
    );
    expect(sequenceRecord!.createdAt).toBeInstanceOf(Date);
    expect(sequenceRecord!.updatedAt).toBeInstanceOf(Date);

    // 5. Verify format pattern: HES-CASHUB-YYYY-XXXXXX
    trackingNumbers.forEach((tn) => {
      expect(tn).toMatch(/^HES-CASHUB-\d{4}-\d{6}$/);
    });
  }, 30000);
});
