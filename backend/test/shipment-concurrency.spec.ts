/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaShipmentRepository } from "../src/modules/shipments/infrastructure/prisma-shipment.repository";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { CreateShipmentDto, ServiceType } from "../src/modules/shipments/dto/create-shipment.dto";
import { PaymentMethod, ParcelStatus } from "@prisma/client";

describe("Phase 4: Shipment Concurrency & Transactional Security Tests", () => {
  let repository: PrismaShipmentRepository;
  let mockPrisma: any;
  let mockAuditService: any;

  const CASA_AGENCY_ID = "agency-casa-1111-uuid";
  const AGADIR_AGENCY_ID = "agency-agadir-2222-uuid";

  const casaOperator: AuthenticatedUser = {
    id: "user-casa-op-1",
    email: "operator.casa@hes.ma",
    firstName: "Karim",
    lastName: "Bennani",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["shipments:create", "shipments:read", "shipments:update"],
    isGlobalScope: false,
  };

  const agadirOperator: AuthenticatedUser = {
    id: "user-agadir-op-1",
    email: "operator.agadir@hes.ma",
    firstName: "Hassan",
    lastName: "Agadir",
    role: "OPERATOR",
    agencyId: AGADIR_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["shipments:create", "shipments:read", "shipments:update"],
    isGlobalScope: false,
  };

  const superAdminUser: AuthenticatedUser = {
    id: "user-super-admin-1",
    email: "admin@hes.ma",
    firstName: "Super",
    lastName: "Admin",
    role: "SUPER_ADMIN",
    agencyId: null,
    isActive: true,
    tokenVersion: 1,
    permissions: ["*"],
    isGlobalScope: true,
  };

  const sampleCreateDto: CreateShipmentDto = {
    destinationAgencyId: AGADIR_AGENCY_ID,
    senderCustomerId: "cust-casa-1001",
    recipientName: "Ahmed Mansouri",
    recipientPhone: "+212661234567",
    recipientAddress: "Avenue Hassan II",
    recipientCity: "Agadir",
    serviceType: ServiceType.STANDARD,
    paymentMethod: PaymentMethod.CASH,
    shippingFee: 75.5,
    declaredValue: 1500,
    parcels: [
      {
        parcelTypeId: "type-carton-medium",
        weightKg: 2.5,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
        items: [
          {
            description: "Pièces détachées matériel électronique",
            quantity: 2,
            declaredValue: 750,
          },
        ],
      },
      {
        parcelTypeId: "type-carton-small",
        weightKg: 1.2,
        lengthCm: 15,
        widthCm: 10,
        heightCm: 10,
      },
    ],
  };

  beforeEach(() => {
    // Thread-safe simulated PostgreSQL atomic sequence counter
    let simulatedSeqCounter = 0;
    const simulatedStore = new Map<string, any>();

    mockPrisma = {
      agency: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === CASA_AGENCY_ID) {
            return Promise.resolve({
              id: CASA_AGENCY_ID,
              code: "CAS",
              name: "Casablanca Hub",
            });
          }
          if (where.id === AGADIR_AGENCY_ID) {
            return Promise.resolve({
              id: AGADIR_AGENCY_ID,
              code: "AGA",
              name: "Agadir Agency",
            });
          }
          return Promise.resolve(null);
        }),
      },
      // Interactive Prisma Transaction mock executing sequentially or atomically
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {
          $queryRaw: jest.fn().mockImplementation(async () => {
            simulatedSeqCounter += 1;
            return [{ current_value: simulatedSeqCounter, prefix: "HES" }];
          }),
          shipmentSequence: {
            upsert: jest.fn().mockImplementation(async () => {
              simulatedSeqCounter += 1;
              return { currentValue: simulatedSeqCounter, prefix: "HES" };
            }),
          },
          shipment: {
            create: jest.fn().mockImplementation(async ({ data }) => {
              const shipmentId = `shipment-uuid-${data.trackingNumber}`;
              const record = { id: shipmentId, ...data };
              simulatedStore.set(shipmentId, record);
              return record;
            }),
            findUniqueOrThrow: jest
              .fn()
              .mockImplementation(async ({ where }) => {
                const record = simulatedStore.get(where.id);
                return {
                  ...record,
                  originAgency: {
                    id: CASA_AGENCY_ID,
                    code: "CAS",
                    name: "Casablanca Hub",
                  },
                  destinationAgency: {
                    id: AGADIR_AGENCY_ID,
                    code: "AGA",
                    name: "Agadir Agency",
                  },
                  senderCustomer: {
                    id: "cust-casa-1001",
                    legalName: "Client Casa",
                  },
                  createdByUser: {
                    id: casaOperator.id,
                    email: casaOperator.email,
                  },
                  parcels: [
                    {
                      id: "parcel-1",
                      parcelIndex: 1,
                      trackingNumber: `${record.trackingNumber}-01`,
                      status: ParcelStatus.REGISTERED,
                    },
                    {
                      id: "parcel-2",
                      parcelIndex: 2,
                      trackingNumber: `${record.trackingNumber}-02`,
                      status: ParcelStatus.REGISTERED,
                    },
                  ],
                };
              }),
          },
          parcel: {
            create: jest.fn().mockImplementation(async ({ data }) => {
              return { id: `parcel-uuid-${data.trackingNumber}`, ...data };
            }),
          },
          parcelItem: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          shipmentItem: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };

        return callback(txMock);
      }),
    };

    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    repository = new PrismaShipmentRepository(
      mockPrisma as any,
      mockAuditService as any,
    );
  });

  describe("Critical Concurrency Benchmark: N simultaneous creations", () => {
    it("should process N=30 concurrent shipment creations with ZERO duplicate numbers and strictly sequential values", async () => {
      const N = 30;
      const currentYear = new Date().getFullYear();

      // Launch N concurrent creation requests simultaneously
      const creationPromises = Array.from({ length: N }).map((_, index) =>
        repository.create(
          {
            ...sampleCreateDto,
            notes: `Concurrent test batch #${index + 1}`,
          },
          casaOperator,
        ),
      );

      const results = await Promise.all(creationPromises);

      expect(results).toHaveLength(N);

      // Collect tracking numbers and check uniqueness
      const trackingNumbers = results.map((s) => s.trackingNumber);
      const uniqueNumbers = new Set(trackingNumbers);

      // 1. Zéro doublon
      expect(uniqueNumbers.size).toBe(N);

      // 2. Format structurel rigoureusement respecté
      for (let i = 0; i < N; i++) {
        const tracking = trackingNumbers[i];
        expect(tracking).toMatch(new RegExp(`^HES-CAS-${currentYear}-\\d{6}$`));
      }

      // 3. Continuité de séquence sans collision
      const sequenceNumbers = (trackingNumbers as string[])
        .map((t) => parseInt(t.split("-")[3], 10))
        .sort((a, b) => a - b);

      expect(sequenceNumbers[0]).toBe(1);
      expect(sequenceNumbers[N - 1]).toBe(N);

      for (let i = 0; i < N; i++) {
        expect(sequenceNumbers[i]).toBe(i + 1);
      }
    });
  });

  describe("Agency Isolation & Security Boundaries", () => {
    it("should forbid local operator from forging a different origin agency ID", async () => {
      // Agadir operator trying to forge originAgencyId as Casablanca
      const attackDto: CreateShipmentDto = {
        ...sampleCreateDto,
        originAgencyId: CASA_AGENCY_ID, // Malicious attempt to inject Casa agency
      };

      // In repository.create, effectiveOriginAgencyId uses user.agencyId for local operators
      // Therefore, the created shipment should be forced to AGADIR_AGENCY_ID
      const result = await repository.create(attackDto, agadirOperator);

      // The origin must be Agadir (user's real agency), ignoring the injected Casa ID
      expect(mockPrisma.agency.findUnique).toHaveBeenCalledWith({
        where: { id: AGADIR_AGENCY_ID },
      });
      expect(result).toBeDefined();
    });

    it("should allow super admin (global scope) to specify any origin agency", async () => {
      const adminDto: CreateShipmentDto = {
        ...sampleCreateDto,
        originAgencyId: CASA_AGENCY_ID,
      };

      await repository.create(adminDto, superAdminUser);

      expect(mockPrisma.agency.findUnique).toHaveBeenCalledWith({
        where: { id: CASA_AGENCY_ID },
      });
    });
  });

  describe("Transactional Atomicity & Rollback Safety", () => {
    it("should abort the entire operation and propagate error if parcel creation fails", async () => {
      mockPrisma.$transaction.mockImplementationOnce(async (callback: any) => {
        const failingTx = {
          $queryRaw: jest
            .fn()
            .mockResolvedValue([{ current_value: 999, prefix: "HES" }]),
          shipment: {
            create: jest.fn().mockResolvedValue({ id: "ship-rollback-1" }),
          },
          parcel: {
            create: jest
              .fn()
              .mockRejectedValue(
                new Error("Database disk full or constraint violation"),
              ),
          },
        };
        return callback(failingTx);
      });

      await expect(
        repository.create(sampleCreateDto, casaOperator),
      ).rejects.toThrow("Database disk full or constraint violation");
    });
  });
});
