/* eslint-disable @typescript-eslint/no-explicit-any */
import { CreateReturnUseCase } from "../src/modules/returns/application/use-cases/create-return.use-case";
import { RecoverReturnUseCase } from "../src/modules/returns/application/use-cases/recover-return.use-case";
import { ListReturnsUseCase } from "../src/modules/returns/application/use-cases/list-returns.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import {
  ParcelStatus,
  ReturnStatus,
  ReturnItemStatus,
  ReturnType,
} from "@prisma/client";
import { NotFoundException } from "@nestjs/common";
import { ReturnCreatedEvent } from "../src/common/events/return.events";

describe("Phase 10 Backend Tests: Returns Management, Recovery with/without Scan & Emergency Fallback", () => {
  let createReturnUseCase: CreateReturnUseCase;
  let recoverReturnUseCase: RecoverReturnUseCase;
  let listReturnsUseCase: ListReturnsUseCase;
  let mockPrisma: any;
  let mockEventBus: any;

  const CASA_AGENCY_ID = "ag-casa-uuid";
  const TANGER_AGENCY_ID = "ag-tanger-uuid";

  const courierUser: AuthenticatedUser = {
    id: "user-courier-rachid",
    email: "rachid@hes.ma",
    firstName: "Rachid",
    lastName: "Livreur",
    role: "COURIER",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["returns:recover"],
    isGlobalScope: false,
  };

  const agencyOperatorUser: AuthenticatedUser = {
    id: "user-operator-amine",
    email: "amine.quai@hes.ma",
    firstName: "Amine",
    lastName: "AgentQuai",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["returns:manage"],
    isGlobalScope: false,
  };

  let returnsRecord: any[];
  let returnItemsRecord: any[];
  let parcelsRecord: any[];
  let shipmentRecord: any;
  let trackingEventsRecord: any[];

  beforeEach(() => {
    returnsRecord = [];
    returnItemsRecord = [];
    trackingEventsRecord = [];

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    shipmentRecord = {
      id: "shipment-uuid-001",
      trackingNumber: "HES-CAS-2026-000100",
      originAgencyId: CASA_AGENCY_ID,
      destinationAgencyId: TANGER_AGENCY_ID,
      originAgency: { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Hub" },
      destinationAgency: {
        id: TANGER_AGENCY_ID,
        code: "TNG",
        name: "Tanger Hub",
      },
      senderCustomer: { id: "cust-1", legalName: "Maroc E-commerce SARL" },
      recipientName: "Omar Tazi",
      recipientCity: "Tanger",
      parcels: [],
    };

    parcelsRecord = [
      {
        id: "parcel-1",
        shipmentId: shipmentRecord.id,
        trackingNumber: "HES-CAS-2026-000100-01",
        barcode: "BL-TNG-2026-001",
        status: ParcelStatus.OUT_FOR_DELIVERY,
        currentAgencyId: TANGER_AGENCY_ID,
        weightKg: 2.0,
        shipment: shipmentRecord,
        returnItems: [],
      },
      {
        id: "parcel-2",
        shipmentId: shipmentRecord.id,
        trackingNumber: "HES-CAS-2026-000100-02",
        barcode: "BL-TNG-2026-002",
        status: ParcelStatus.OUT_FOR_DELIVERY,
        currentAgencyId: TANGER_AGENCY_ID,
        weightKg: 1.5,
        shipment: shipmentRecord,
        returnItems: [],
      },
    ];

    shipmentRecord.parcels = parcelsRecord;

    mockPrisma = {
      shipment: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === shipmentRecord.id) return shipmentRecord;
          return null;
        }),
      },
      parcel: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where.OR) {
            for (const cond of where.OR) {
              const p = parcelsRecord.find(
                (item) =>
                  (cond.trackingNumber &&
                    item.trackingNumber === cond.trackingNumber) ||
                  (cond.barcode && item.barcode === cond.barcode) ||
                  (cond.id && item.id === cond.id),
              );
              if (p) {
                const items = returnItemsRecord.filter(
                  (ri) => ri.parcelId === p.id,
                );
                return { ...p, returnItems: items };
              }
            }
          }
          return null;
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
      return: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const ret = {
            id: `ret-${Date.now()}-${Math.random()}`,
            ...data,
            number: data.number || data.returnNumber,
            returnNumber: data.number || data.returnNumber,
            createdAt: new Date(),
          };
          returnsRecord.push(ret);
          return ret;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = returnsRecord.findIndex((r) => r.id === where.id);
          if (idx !== -1) {
            returnsRecord[idx] = { ...returnsRecord[idx], ...data };
            return returnsRecord[idx];
          }
          return null;
        }),
        count: jest.fn().mockImplementation(async () => returnsRecord.length),
        findMany: jest.fn().mockImplementation(async () => {
          return returnsRecord.map((r) => ({
            ...r,
            number: r.number || r.returnNumber,
            returnNumber: r.number || r.returnNumber,
            shipment: shipmentRecord,
            originAgency: shipmentRecord.destinationAgency,
            destinationAgency: shipmentRecord.originAgency,
            handledByUser: courierUser,
            assignedCourier: courierUser,
            items: returnItemsRecord.filter((it) => it.returnId === r.id),
          }));
        }),
      },
      returnItem: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const item = {
            id: `item-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          returnItemsRecord.push(item);
          return item;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = returnItemsRecord.findIndex((it) => it.id === where.id);
          if (idx !== -1) {
            returnItemsRecord[idx] = { ...returnItemsRecord[idx], ...data };
            return returnItemsRecord[idx];
          }
          return null;
        }),
      },
      trackingEvent: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const evt = {
            id: `evt-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          trackingEventsRecord.push(evt);
          return evt;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    createReturnUseCase = new CreateReturnUseCase(mockPrisma, mockEventBus);
    recoverReturnUseCase = new RecoverReturnUseCase(mockPrisma, mockEventBus);
    listReturnsUseCase = new ListReturnsUseCase(mockPrisma);
  });

  it("Workflow: Manual return creation registers Return root and ReturnItems in PENDING and publishes ReturnCreatedEvent", async () => {
    const res = await createReturnUseCase.execute(
      {
        shipmentId: shipmentRecord.id,
        returnType: ReturnType.CUSTOMER_RETURN,
        parcelIds: ["parcel-1", "parcel-2"],
        reasonNotes:
          "Client expéditeur demande rapatriement d'urgence du stock",
      },
      agencyOperatorUser,
    );

    expect(res.returnNumber).toMatch(/^RET-TNG-/);
    expect(res.status).toBe(ReturnStatus.INITIATED);
    expect(res.items).toHaveLength(2);
    expect(res.items[0].status).toBe(ReturnItemStatus.PENDING);
    expect(parcelsRecord[0].status).toBe(ParcelStatus.RETURNED);
    expect(parcelsRecord[1].status).toBe(ParcelStatus.RETURNED);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(ReturnCreatedEvent),
    );
  });

  it("Recovery via physical scan: Courier scans barcode and updates ReturnItem to RECOVERED with recoveredViaScan = true", async () => {
    // Pre-create return
    await createReturnUseCase.execute(
      {
        shipmentId: shipmentRecord.id,
        parcelIds: ["parcel-1"],
      },
      agencyOperatorUser,
    );

    // Courier scans parcel barcode "BL-TNG-2026-001"
    const recoveryRes = await recoverReturnUseCase.execute(
      {
        identifier: "BL-TNG-2026-001",
        isScan: true,
      },
      courierUser,
    );

    expect(recoveryRes.recoveredVia).toBe("SCAN");
    expect((recoveryRes.returnItem as any).status).toBe(ReturnItemStatus.RECOVERED);
    expect((recoveryRes.returnItem as any).recoveredViaScan).toBe(true);
    expect((recoveryRes.returnItem as any).recoveredManually).toBe(false);
    expect((recoveryRes.returnItem as any).recoveredByCourierId).toBe(courierUser.id);
  });

  it("Recovery via manual entry: Courier enters BL / tracking number on keyboard without scan", async () => {
    // Pre-create return
    await createReturnUseCase.execute(
      {
        shipmentId: shipmentRecord.id,
        parcelIds: ["parcel-2"],
      },
      agencyOperatorUser,
    );

    // Courier types tracking number manually
    const manualRecoveryRes = await recoverReturnUseCase.execute(
      {
        identifier: "HES-CAS-2026-000100-02",
        isScan: false,
      },
      courierUser,
    );

    expect(manualRecoveryRes.recoveredVia).toBe("MANUAL");
    expect((manualRecoveryRes.returnItem as any).status).toBe(
      ReturnItemStatus.RECOVERED,
    );
    expect((manualRecoveryRes.returnItem as any).recoveredViaScan).toBe(false);
    expect((manualRecoveryRes.returnItem as any).recoveredManually).toBe(true);
  });

  it("Emergency Fallback Procedure: Courier triggers emergency recovery for unreadable / damaged BL with mandatory reason", async () => {
    const emergencyRes = await recoverReturnUseCase.execute(
      {
        identifier: "parcel-1",
        isScan: false,
        isFallbackEmergency: true,
        emergencyReason:
          "Étiquette et BL détrempés suite intempéries, concordance vérifiée par téléphone",
      },
      courierUser,
    );

    expect(emergencyRes.isEmergency).toBe(true);
    expect((emergencyRes.returnItem as any).isFallbackEmergency).toBe(true);
    expect((emergencyRes.returnItem as any).emergencyReason).toContain(
      "Étiquette et BL détrempés",
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(ReturnCreatedEvent),
    );
  });

  it("Throws NotFoundException when unknown BL or tracking is entered", async () => {
    await expect(
      recoverReturnUseCase.execute(
        {
          identifier: "UNKNOWN-BL-9999",
          isScan: false,
        },
        courierUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("ListReturnsUseCase: Lists return dossiers with items and metrics", async () => {
    await createReturnUseCase.execute(
      {
        shipmentId: shipmentRecord.id,
        parcelIds: ["parcel-1"],
      },
      agencyOperatorUser,
    );

    const listRes = await listReturnsUseCase.execute({}, agencyOperatorUser);
    expect(listRes.data).toHaveLength(1);
    expect((listRes.data[0] as any).returnNumber).toBeDefined();
    expect((listRes.data[0] as any).shipment.trackingNumber).toBe("HES-CAS-2026-000100");
  });
});

