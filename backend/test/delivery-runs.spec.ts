/* eslint-disable @typescript-eslint/no-explicit-any */
import { AutoAssignRunsUseCase } from "../src/modules/runs/application/use-cases/auto-assign-runs.use-case";
import { ReassignParcelRunUseCase } from "../src/modules/runs/application/use-cases/reassign-parcel-run.use-case";
import { ListDeliveryRunsUseCase } from "../src/modules/runs/application/use-cases/list-delivery-runs.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import {
  ParcelStatus,
  RunShift,
  DeliveryRunStatus,
  CourierStatus,
} from "@prisma/client";
import { BadRequestException } from "@nestjs/common";

describe("Phase 8 Backend Tests: Delivery Runs & Last-Mile Assignment", () => {
  let autoAssignUseCase: AutoAssignRunsUseCase;
  let reassignUseCase: ReassignParcelRunUseCase;
  let listRunsUseCase: ListDeliveryRunsUseCase;
  let mockPrisma: any;
  let mockEventBus: any;

  const CASA_AGENCY_ID = "ag-casa-uuid-111";
  const ZONE_MAARIF_ID = "zone-maarif-uuid";
  const ZONE_ANFA_ID = "zone-anfa-uuid";

  const dispatcherUser: AuthenticatedUser = {
    id: "user-dispatch-1",
    email: "dispatch@hes.ma",
    firstName: "Amine",
    lastName: "Dispatcher",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["runs:manage", "runs:read"],
    isGlobalScope: false,
  };

  const courierUser1: AuthenticatedUser = {
    id: "user-courier-1",
    email: "courier1@hes.ma",
    firstName: "Rachid",
    lastName: "Livreur1",
    role: "COURIER",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["runs:read"],
    isGlobalScope: false,
  };

  const courierUser2: AuthenticatedUser = {
    id: "user-courier-2",
    email: "courier2@hes.ma",
    firstName: "Tarik",
    lastName: "Livreur2",
    role: "COURIER",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["runs:read"],
    isGlobalScope: false,
  };

  let deliveryRunsRecord: any[];
  let deliveryRunItemsRecord: any[];
  let runAuditLogsRecord: any[];
  let parcelsRecord: any[];
  let zonesRecord: any[];
  let courierProfilesRecord: any[];

  beforeEach(() => {
    deliveryRunsRecord = [];
    deliveryRunItemsRecord = [];
    runAuditLogsRecord = [];

    zonesRecord = [
      {
        id: ZONE_MAARIF_ID,
        agencyId: CASA_AGENCY_ID,
        code: "MAARIF",
        name: "Maârif",
        postalCodes: "20100, 20330",
        isActive: true,
        deletedAt: null,
      },
      {
        id: ZONE_ANFA_ID,
        agencyId: CASA_AGENCY_ID,
        code: "ANFA",
        name: "Anfa Supérieur",
        postalCodes: "20050",
        isActive: true,
        deletedAt: null,
      },
    ];

    courierProfilesRecord = [
      {
        id: "profile-rachid",
        userId: courierUser1.id,
        agencyId: CASA_AGENCY_ID,
        primaryZoneId: ZONE_MAARIF_ID,
        secondaryZones: [],
        maxCapacityKg: 50.0,
        maxParcelsCapacity: 30,
        status: CourierStatus.AVAILABLE,
        isActive: true,
        deliveryRuns: [],
        user: { ...courierUser1 },
      },
      {
        id: "profile-tarik",
        userId: courierUser2.id,
        agencyId: CASA_AGENCY_ID,
        primaryZoneId: ZONE_ANFA_ID,
        secondaryZones: [],
        maxCapacityKg: 40.0,
        maxParcelsCapacity: 20,
        status: CourierStatus.AVAILABLE,
        isActive: true,
        deliveryRuns: [],
        user: { ...courierUser2 },
      },
    ];

    parcelsRecord = [
      {
        id: "parcel-maarif-1",
        trackingNumber: "HES-CAS-2026-0001-01",
        currentAgencyId: CASA_AGENCY_ID,
        status: ParcelStatus.AT_HUB,
        weightKg: 2.5,
        deletedAt: null,
        shipment: {
          id: "ship-1",
          recipientAddress: "12 Boulevard Zerktouni, Maârif",
          recipientCity: "Casablanca",
          recipientZoneId: null,
          codAmount: 250.0,
        },
      },
      {
        id: "parcel-anfa-1",
        trackingNumber: "HES-CAS-2026-0002-01",
        currentAgencyId: CASA_AGENCY_ID,
        status: ParcelStatus.AT_HUB,
        weightKg: 4.0,
        deletedAt: null,
        shipment: {
          id: "ship-2",
          recipientAddress: "8 Boulevard d'Anfa",
          recipientCity: "Casablanca",
          recipientZoneId: null,
          codAmount: 400.0,
        },
      },
      {
        id: "parcel-unzoned-1",
        trackingNumber: "HES-CAS-2026-0003-01",
        currentAgencyId: CASA_AGENCY_ID,
        status: ParcelStatus.AT_HUB,
        weightKg: 1.5,
        deletedAt: null,
        shipment: {
          id: "ship-3",
          recipientAddress: "Douar Oulad Saleh, Province Médiouna",
          recipientCity: "Périphérie Casablanca",
          recipientZoneId: null,
          codAmount: 0.0,
        },
      },
    ];

    mockPrisma = {
      parcel: {
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return parcelsRecord.filter((p) => {
            if (
              where.currentAgencyId &&
              p.currentAgencyId !== where.currentAgencyId
            )
              return false;
            if (where.status?.in && !where.status.in.includes(p.status))
              return false;
            return true;
          });
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return parcelsRecord.find((p) => p.id === where.id) || null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = parcelsRecord.findIndex((p) => p.id === where.id);
          if (idx !== -1) {
            parcelsRecord[idx] = { ...parcelsRecord[idx], ...data };
            return parcelsRecord[idx];
          }
          return null;
        }),
      },
      zone: {
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return zonesRecord.filter((z) => {
            if (where.agencyId && z.agencyId !== where.agencyId) return false;
            if (where.isActive !== undefined && z.isActive !== where.isActive)
              return false;
            return true;
          });
        }),
      },
      agency: {
        findUnique: jest.fn().mockResolvedValue({
          id: CASA_AGENCY_ID,
          code: "CAS",
          name: "Casablanca Hub",
        }),
      },
      courierProfile: {
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return courierProfilesRecord.filter((c) => {
            if (where.agencyId && c.agencyId !== where.agencyId) return false;
            if (where.isActive !== undefined && c.isActive !== where.isActive)
              return false;
            return true;
          });
        }),
      },
      deliveryRun: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return (
            deliveryRunsRecord.find(
              (r) => r.courierId === where.courierId && r.shift === where.shift,
            ) || null
          );
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const run = deliveryRunsRecord.find((r) => r.id === where.id);
          if (!run) return null;
          const profile = courierProfilesRecord.find(
            (cp) => cp.id === run.courierId,
          );
          return {
            ...run,
            courier: profile,
          };
        }),
        count: jest.fn().mockImplementation(async ({ where }) => {
          if (where?.courier?.userId) {
            return deliveryRunsRecord.filter((r) => {
              const cp = courierProfilesRecord.find(
                (p) => p.id === r.courierId,
              );
              return cp?.userId === where.courier.userId;
            }).length;
          }
          return deliveryRunsRecord.length;
        }),
        create: jest.fn().mockImplementation(async ({ data }) => {
          const run = {
            id: `run-${Date.now()}-${Math.random()}`,
            ...data,
            items: [],
          };
          deliveryRunsRecord.push(run);
          return run;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = deliveryRunsRecord.findIndex((r) => r.id === where.id);
          if (idx !== -1) {
            deliveryRunsRecord[idx] = { ...deliveryRunsRecord[idx], ...data };
            return deliveryRunsRecord[idx];
          }
          return null;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return deliveryRunsRecord.filter((r) => {
            if (where?.courier?.userId) {
              const cp = courierProfilesRecord.find(
                (p) => p.id === r.courierId,
              );
              return cp?.userId === where.courier.userId;
            }
            return true;
          });
        }),
      },
      deliveryRunItem: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const item = deliveryRunItemsRecord.find(
            (i) => i.parcelId === where.parcelId,
          );
          if (!item) return null;
          const run = deliveryRunsRecord.find(
            (r) => r.id === item.deliveryRunId,
          );
          return { ...item, deliveryRun: run };
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return deliveryRunItemsRecord
            .filter((i) => i.deliveryRunId === where.deliveryRunId)
            .map((i) => {
              const parcel = parcelsRecord.find((p) => p.id === i.parcelId);
              return { ...i, parcel };
            });
        }),
        count: jest.fn().mockImplementation(async ({ where }) => {
          return deliveryRunItemsRecord.filter(
            (i) => i.deliveryRunId === where.deliveryRunId,
          ).length;
        }),
        upsert: jest.fn().mockImplementation(async ({ create }) => {
          const item = { id: `item-${Date.now()}-${Math.random()}`, ...create };
          deliveryRunItemsRecord.push(item);
          return item;
        }),
        create: jest.fn().mockImplementation(async ({ data }) => {
          const item = { id: `item-${Date.now()}-${Math.random()}`, ...data };
          deliveryRunItemsRecord.push(item);
          return item;
        }),
        delete: jest.fn().mockImplementation(async ({ where }) => {
          const idx = deliveryRunItemsRecord.findIndex(
            (i) => i.id === where.id,
          );
          if (idx !== -1) {
            deliveryRunItemsRecord.splice(idx, 1);
          }
          return {};
        }),
      },
      runAuditLog: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const log = {
            id: `audit-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          runAuditLogsRecord.push(log);
          return log;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    autoAssignUseCase = new AutoAssignRunsUseCase(mockPrisma, mockEventBus);
    reassignUseCase = new ReassignParcelRunUseCase(mockPrisma, mockEventBus);
    listRunsUseCase = new ListDeliveryRunsUseCase(mockPrisma);
  });

  it("Algorithm: Correctly assigns parcels by zone, creates morning runs, isolates unzoned parcels and publishes ShipmentAssignedToCourier", async () => {
    const result = await autoAssignUseCase.execute(
      {
        agencyId: CASA_AGENCY_ID,
        runDate: "2026-09-03",
        shift: RunShift.MORNING,
      },
      dispatcherUser,
    );

    // 2 parcels matched zones, 1 unzoned parcel (Douar Oulad Saleh)
    expect(result.assignedParcelsCount).toBe(2);
    expect(result.unzonedParcelsCount).toBe(1);
    expect(result.unzonedParcels[0].parcelId).toBe("parcel-unzoned-1");
    expect(result.createdRunsCount).toBe(2);

    // Verify delivery runs created
    expect(deliveryRunsRecord).toHaveLength(2);

    // Verify Rachid's run has Maârif parcel
    const rachidRun = deliveryRunsRecord.find(
      (r) => r.courierId === "profile-rachid",
    );
    expect(rachidRun).toBeDefined();
    expect(rachidRun.shift).toBe(RunShift.MORNING);
    expect(rachidRun.totalParcels).toBe(1);
    expect(rachidRun.totalWeightKg).toBe(2.5);

    // Verify Tarik's run has Anfa parcel
    const tarikRun = deliveryRunsRecord.find(
      (r) => r.courierId === "profile-tarik",
    );
    expect(tarikRun).toBeDefined();
    expect(tarikRun.shift).toBe(RunShift.MORNING);
    expect(tarikRun.totalParcels).toBe(1);
    expect(tarikRun.totalWeightKg).toBe(4.0);

    // Verify parcel courierId was updated
    expect(parcelsRecord[0].courierId).toBe(courierUser1.id);
    expect(parcelsRecord[1].courierId).toBe(courierUser2.id);

    // Verify domain event publication
    expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "ShipmentAssignedToCourier",
        payload: expect.objectContaining({
          parcelId: "parcel-maarif-1",
          courierUserId: courierUser1.id,
          agencyId: CASA_AGENCY_ID,
          isOutOfZone: false,
        }),
      }),
    );
  });

  it("Manual Reassignment: Reassigns parcel to another run with mandatory audit log, reason >= 5 chars, and publishes event", async () => {
    // Setup existing run for Rachid with parcel-maarif-1
    const runRachid = {
      id: "run-rachid-id",
      runNumber: "RUN-CAS-20260903-001",
      agencyId: CASA_AGENCY_ID,
      courierId: "profile-rachid",
      shift: RunShift.MORNING,
      status: DeliveryRunStatus.PLANNED,
      totalParcels: 1,
      totalWeightKg: 2.5,
      totalCodToCollect: 250,
    };
    const runTarik = {
      id: "run-tarik-id",
      runNumber: "RUN-CAS-20260903-002",
      agencyId: CASA_AGENCY_ID,
      courierId: "profile-tarik",
      shift: RunShift.MORNING,
      status: DeliveryRunStatus.PLANNED,
      totalParcels: 1,
      totalWeightKg: 4.0,
      totalCodToCollect: 400,
    };
    deliveryRunsRecord.push(runRachid, runTarik);

    deliveryRunItemsRecord.push({
      id: "item-rachid-1",
      deliveryRunId: runRachid.id,
      parcelId: "parcel-maarif-1",
    });

    // Reassign parcel-maarif-1 to Tarik with audited reason
    const reassignResult = await reassignUseCase.execute(
      {
        parcelId: "parcel-maarif-1",
        targetRunId: runTarik.id,
        reason: "Client demande livraison groupée chez son frère à Anfa",
        isOutOfZone: true,
      },
      dispatcherUser,
    );

    expect(reassignResult.targetRunId).toBe(runTarik.id);
    expect(reassignResult.item.isOutOfZone).toBe(true);

    // Assert audit log was recorded
    expect(runAuditLogsRecord).toHaveLength(1);
    const log = runAuditLogsRecord[0];
    expect(log.action).toBe("ZONE_OVERRIDE");
    expect(log.performedById).toBe(dispatcherUser.id);
    expect(log.reason).toBe(
      "Client demande livraison groupée chez son frère à Anfa",
    );
    expect(log.previousValue).toBe("RUN-CAS-20260903-001");

    // Assert parcel courier was updated
    expect(parcelsRecord[0].courierId).toBe(courierUser2.id);

    // Assert event was published
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "ShipmentAssignedToCourier",
        payload: expect.objectContaining({
          parcelId: "parcel-maarif-1",
          courierUserId: courierUser2.id,
          isOutOfZone: true,
        }),
      }),
    );
  });

  it("Audit enforcement: Reassignment without valid reason is rejected with BadRequestException", async () => {
    await expect(
      reassignUseCase.execute(
        {
          parcelId: "parcel-maarif-1",
          targetRunId: "run-tarik-id",
          reason: "nc", // Less than 5 characters
        },
        dispatcherUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("Courier Security Isolation: Courier 1 can only see their own runs and is isolated from Courier 2", async () => {
    deliveryRunsRecord.push(
      {
        id: "run-rachid",
        runNumber: "RUN-CAS-001",
        courierId: "profile-rachid",
        shift: RunShift.MORNING,
      },
      {
        id: "run-tarik",
        runNumber: "RUN-CAS-002",
        courierId: "profile-tarik",
        shift: RunShift.MORNING,
      },
    );

    // Courier Rachid queries
    const resultCourier1 = await listRunsUseCase.execute({}, courierUser1);
    expect(resultCourier1.data).toHaveLength(1);
    expect(resultCourier1.data[0].id).toBe("run-rachid");

    // Courier Tarik queries
    const resultCourier2 = await listRunsUseCase.execute({}, courierUser2);
    expect(resultCourier2.data).toHaveLength(1);
    expect(resultCourier2.data[0].id).toBe("run-tarik");
  });
});
