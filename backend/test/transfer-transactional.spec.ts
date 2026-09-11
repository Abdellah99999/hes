/* eslint-disable @typescript-eslint/no-explicit-any */
import { CreateTransferUseCase } from "../src/modules/transfers/application/use-cases/create-transfer.use-case";
import { DispatchTransferUseCase } from "../src/modules/transfers/application/use-cases/dispatch-transfer.use-case";
import { ReceiveTransferUseCase } from "../src/modules/transfers/application/use-cases/receive-transfer.use-case";
import { GetAgencyStockUseCase } from "../src/modules/transfers/application/use-cases/get-agency-stock.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import {
  TransferStatus,
  TransferItemStatus,
  ParcelStatus,
} from "@prisma/client";

describe("Phase 6 Backend Tests: Transfer Transactional Lifecycle, Discrepancy Reconciliation & Event Bus", () => {
  let createUseCase: CreateTransferUseCase;
  let dispatchUseCase: DispatchTransferUseCase;
  let receiveUseCase: ReceiveTransferUseCase;
  let stockUseCase: GetAgencyStockUseCase;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockEventBus: any;

  const CASA_AGENCY_ID = "agency-casa-1111";
  const RABAT_AGENCY_ID = "agency-rabat-2222";
  const FES_AGENCY_ID = "agency-fes-3333";

  const casaOperator: AuthenticatedUser = {
    id: "user-op-casa",
    email: "operator.casa@hes.ma",
    firstName: "Karim",
    lastName: "Casa",
    role: "AGENT",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["transfers:update", "transfers:create"],
    isGlobalScope: false,
  };

  const rabatOperator: AuthenticatedUser = {
    id: "user-op-rabat",
    email: "operator.rabat@hes.ma",
    firstName: "Hassan",
    lastName: "Rabat",
    role: "AGENT",
    agencyId: RABAT_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["transfers:update", "transfers:read", "shipments:read"],
    isGlobalScope: false,
  };

  // In-memory simulated database records
  let transferRecord: any;
  let parcelsRecord: any[];
  let transferItemsRecord: any[];

  beforeEach(() => {
    parcelsRecord = [
      {
        id: "parcel-p1-uuid",
        trackingNumber: "HES-CAS-2026-000001-01",
        shipmentId: "shipment-1-uuid",
        weightKg: 2.5,
        status: ParcelStatus.REGISTERED,
        currentAgencyId: CASA_AGENCY_ID,
        currentTransferId: null,
        deletedAt: null,
        createdAt: new Date(),
      },
      {
        id: "parcel-p2-uuid",
        trackingNumber: "HES-CAS-2026-000001-02",
        shipmentId: "shipment-1-uuid",
        weightKg: 3.0,
        status: ParcelStatus.REGISTERED,
        currentAgencyId: CASA_AGENCY_ID,
        currentTransferId: null,
        deletedAt: null,
        createdAt: new Date(),
      },
      {
        id: "parcel-p3-uuid", // This one will be lost/missing during transit
        trackingNumber: "HES-CAS-2026-000001-03",
        shipmentId: "shipment-1-uuid",
        weightKg: 1.8,
        status: ParcelStatus.REGISTERED,
        currentAgencyId: CASA_AGENCY_ID,
        currentTransferId: null,
        deletedAt: null,
        createdAt: new Date(),
      },
      {
        id: "parcel-p4-uuid", // Extra parcel to test multiple transfers into Rabat
        trackingNumber: "HES-FES-2026-000002-01",
        shipmentId: "shipment-2-uuid",
        weightKg: 4.2,
        status: ParcelStatus.REGISTERED,
        currentAgencyId: FES_AGENCY_ID,
        currentTransferId: null,
        deletedAt: null,
        createdAt: new Date(),
      },
    ];

    transferItemsRecord = [];

    transferRecord = {
      id: "transfer-100-uuid",
      number: "TRF-CAS-RAB-2026-00001",
      transferNumber: "TRF-CAS-RAB-2026-00001",
      originAgencyId: CASA_AGENCY_ID,
      destinationAgencyId: RABAT_AGENCY_ID,
      status: TransferStatus.PREPARED,
      sealNumber: "SEAL-98765",
      vehiclePlate: "12345-A-1",
      totalExpectedParcels: 3,
      totalReceivedParcels: 0,
      originAgency: { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Hub" },
      destinationAgency: {
        id: RABAT_AGENCY_ID,
        code: "RAB",
        name: "Rabat Agency",
      },
      items: transferItemsRecord,
    };

    mockPrisma = {
      agency: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === RABAT_AGENCY_ID)
            return transferRecord.destinationAgency;
          if (where.id === CASA_AGENCY_ID) return transferRecord.originAgency;
          if (where.id === FES_AGENCY_ID)
            return { id: FES_AGENCY_ID, code: "FES", name: "Fes Agency" };
          return null;
        }),
      },
      transfer: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          transferRecord = {
            id: "transfer-100-uuid",
            ...data,
            originAgency: { id: data.originAgencyId, code: "CAS", name: "Casablanca Hub" },
            destinationAgency: { id: data.destinationAgencyId, code: "RAB", name: "Rabat Agency" },
            items: transferItemsRecord,
          };
          return transferRecord;
        }),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockImplementation(async () => ({
          ...transferRecord,
          items: transferItemsRecord.map((item) => ({
            ...item,
            parcel: parcelsRecord.find((p) => p.id === item.parcelId),
          })),
        })),
        update: jest.fn().mockImplementation(async ({ data }) => {
          transferRecord = { ...transferRecord, ...data };
          return transferRecord;
        }),
      },
      parcel: {
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = parcelsRecord.findIndex((p) => p.id === where.id);
          if (idx !== -1) {
            parcelsRecord[idx] = { ...parcelsRecord[idx], ...data };
            return parcelsRecord[idx];
          }
          return null;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return parcelsRecord.filter((p) => {
            if (where.id?.in && !where.id.in.includes(p.id)) return false;
            if (
              where.currentAgencyId !== undefined &&
              p.currentAgencyId !== where.currentAgencyId
            )
              return false;
            if (where.deletedAt === null && p.deletedAt !== null) return false;
            if (where.status && p.status !== where.status) return false;
            return true;
          });
        }),
        count: jest.fn().mockImplementation(async ({ where }) => {
          const filtered = parcelsRecord.filter((p) => {
            if (
              where.currentAgencyId !== undefined &&
              p.currentAgencyId !== where.currentAgencyId
            )
              return false;
            if (where.deletedAt === null && p.deletedAt !== null) return false;
            return true;
          });
          return filtered.length;
        }),
        aggregate: jest.fn().mockImplementation(async ({ where }) => {
          const filtered = parcelsRecord.filter(
            (p) =>
              p.currentAgencyId === where.currentAgencyId &&
              p.deletedAt === null,
          );
          return {
            _sum: {
              weightKg: filtered.reduce((s, p) => s + p.weightKg, 0),
              volumetricWeightKg: 0,
            },
          };
        }),
        groupBy: jest.fn().mockImplementation(async ({ where }) => {
          const groups: Record<string, number> = {};
          for (const p of parcelsRecord) {
            if (
              p.currentAgencyId === where.currentAgencyId &&
              p.deletedAt === null
            ) {
              groups[p.status] = (groups[p.status] || 0) + 1;
            }
          }
          return Object.entries(groups).map(([status, count]) => ({
            status,
            _count: { id: count },
          }));
        }),
      },
      transferItem: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const item = { id: `item-${transferItemsRecord.length + 1}`, ...data };
          transferItemsRecord.push(item);
          return item;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = transferItemsRecord.findIndex((i) => i.id === where.id);
          if (idx !== -1) {
            transferItemsRecord[idx] = { ...transferItemsRecord[idx], ...data };
            return transferItemsRecord[idx];
          }
          return null;
        }),
      },
      trackingEvent: {
        create: jest.fn().mockResolvedValue({ id: "evt-uuid" }),
      },
      shipment: {
        update: jest.fn().mockResolvedValue({ id: "shipment-1-uuid" }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    createUseCase = new CreateTransferUseCase(mockPrisma, mockEventBus);
    dispatchUseCase = new DispatchTransferUseCase(mockPrisma);
    receiveUseCase = new ReceiveTransferUseCase(
      mockPrisma,
      mockAuditService,
      mockEventBus,
    );
    stockUseCase = new GetAgencyStockUseCase(mockPrisma);
  });

  it("Step 1: CreateTransfer sets up manifest, locks parcels, and publishes TransferCreated event", async () => {
    const created = await createUseCase.execute(
      {
        originAgencyId: CASA_AGENCY_ID,
        destinationAgencyId: RABAT_AGENCY_ID,
        parcelIds: ["parcel-p1-uuid", "parcel-p2-uuid", "parcel-p3-uuid"],
        vehiclePlate: "12345-A-1",
        driverName: "Mohamed Amine",
        sealNumber: "SEAL-98765",
      },
      casaOperator,
    );

    expect(created.status).toBe(TransferStatus.PREPARED);
    expect(created.totalExpectedParcels).toBe(3);
    expect(transferItemsRecord).toHaveLength(3);

    // Verify parcel locking
    expect(parcelsRecord[0].currentTransferId).toBe(created.id);
    expect(parcelsRecord[1].currentTransferId).toBe(created.id);
    expect(parcelsRecord[2].currentTransferId).toBe(created.id);

    // Verify Event Bus published TransferCreated
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "TransferCreated",
        payload: expect.objectContaining({
          transferId: created.id,
          originAgencyId: CASA_AGENCY_ID,
          destinationAgencyId: RABAT_AGENCY_ID,
          totalExpectedParcels: 3,
        }),
      }),
    );
  });

  it("Step 2: DispatchTransfer updates status to IN_TRANSIT and sets parcel currentAgencyId to NULL (Option A / ADR 0002)", async () => {
    await createUseCase.execute(
      {
        originAgencyId: CASA_AGENCY_ID,
        destinationAgencyId: RABAT_AGENCY_ID,
        parcelIds: ["parcel-p1-uuid", "parcel-p2-uuid", "parcel-p3-uuid"],
      },
      casaOperator,
    );

    const dispatched = await dispatchUseCase.execute(
      transferRecord.id,
      { sealNumber: "SEAL-98765-CONFIRMED" },
      casaOperator,
    );

    expect(dispatched.status).toBe(TransferStatus.IN_TRANSIT);
    expect(dispatched.dispatchedAt).toBeDefined();

    // Verify Option A: currentAgencyId is strictly NULL during transit
    for (const p of parcelsRecord.slice(0, 3)) {
      expect(p.status).toBe(ParcelStatus.IN_TRANSIT);
      expect(p.currentAgencyId).toBeNull();
      expect(p.currentTransferId).toBe(transferRecord.id);
    }
  });

  it("Step 3: ReceiveTransfer reconciles Expected vs Received, marks missing as LOST, and publishes TransferReceived event", async () => {
    await createUseCase.execute(
      {
        originAgencyId: CASA_AGENCY_ID,
        destinationAgencyId: RABAT_AGENCY_ID,
        parcelIds: ["parcel-p1-uuid", "parcel-p2-uuid", "parcel-p3-uuid"],
      },
      casaOperator,
    );
    await dispatchUseCase.execute(transferRecord.id, {}, casaOperator);

    // Operator at Rabat receives ONLY P1 and P2 (P3 is missing!)
    const receiveDto = {
      receivedParcelIds: ["HES-CAS-2026-000001-01", "HES-CAS-2026-000001-02"],
      missingParcelNotes: {
        "parcel-p3-uuid":
          "Colis introuvable dans la remorque au déchargement Rabat",
      },
    };

    const result = await receiveUseCase.execute(
      transferRecord.id,
      receiveDto,
      rabatOperator,
    );

    // Assert counters and discrepancy status
    expect(result.receivedCount).toBe(2);
    expect(result.missingCount).toBe(1);
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.transfer.status).toBe(
      TransferStatus.RECEIVED_WITH_DISCREPANCY,
    );
    expect(result.missingParcels[0].trackingNumber).toBe(
      "HES-CAS-2026-000001-03",
    );

    // Assert Parcel P1 & P2: arrived at Rabat
    expect(parcelsRecord[0].status).toBe(ParcelStatus.AT_HUB);
    expect(parcelsRecord[0].currentAgencyId).toBe(RABAT_AGENCY_ID);
    expect(parcelsRecord[0].currentTransferId).toBeNull();

    expect(parcelsRecord[1].status).toBe(ParcelStatus.AT_HUB);
    expect(parcelsRecord[1].currentAgencyId).toBe(RABAT_AGENCY_ID);

    // Assert Parcel P3: marked LOST, currentAgencyId remains NULL
    expect(parcelsRecord[2].status).toBe(ParcelStatus.LOST);
    expect(parcelsRecord[2].currentAgencyId).toBeNull();
    expect(parcelsRecord[2].currentTransferId).toBeNull();

    // Assert Audit Service logged the discrepancy
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          action: "TRANSFER_DISCREPANCY_DETECTED",
          missingCount: 1,
        }),
      }),
    );

    // Assert Event Bus published TransferReceived
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "TransferReceived",
        payload: expect.objectContaining({
          transferId: transferRecord.id,
          receivedCount: 2,
          missingCount: 1,
          hasDiscrepancy: true,
        }),
      }),
    );
  });

  it("Step 4: Agency Stock query after multiple transfers reflects exact physical inventory", async () => {
    // 1. First transfer from Casa to Rabat (P1, P2 received; P3 missing)
    await createUseCase.execute(
      {
        originAgencyId: CASA_AGENCY_ID,
        destinationAgencyId: RABAT_AGENCY_ID,
        parcelIds: ["parcel-p1-uuid", "parcel-p2-uuid", "parcel-p3-uuid"],
      },
      casaOperator,
    );
    await dispatchUseCase.execute(transferRecord.id, {}, casaOperator);
    await receiveUseCase.execute(
      transferRecord.id,
      { receivedParcelIds: ["parcel-p1-uuid", "parcel-p2-uuid"] },
      rabatOperator,
    );

    // 2. Second direct transfer arriving into Rabat from Fes (P4 received)
    parcelsRecord[3].currentAgencyId = RABAT_AGENCY_ID;
    parcelsRecord[3].status = ParcelStatus.AT_HUB;

    // Query Rabat Agency Stock
    const stock = await stockUseCase.execute(
      RABAT_AGENCY_ID,
      {},
      rabatOperator,
    );

    // Rabat has exactly 3 parcels: P1 (2.5kg), P2 (3.0kg), and P4 (4.2kg) = 9.7kg
    expect(stock.summary.totalParcels).toBe(3);
    expect(stock.summary.totalWeightKg).toBe(9.7);
    expect(stock.data).toHaveLength(3);
    expect(stock.data.map((p: any) => p.trackingNumber)).toEqual([
      "HES-CAS-2026-000001-01",
      "HES-CAS-2026-000001-02",
      "HES-FES-2026-000002-01",
    ]);

    // Ensure P3 (LOST) is strictly excluded from stock
    expect(
      stock.data.some(
        (p: any) => p.trackingNumber === "HES-CAS-2026-000001-03",
      ),
    ).toBe(false);
  });
});
