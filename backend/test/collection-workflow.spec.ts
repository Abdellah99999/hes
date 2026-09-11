/* eslint-disable @typescript-eslint/no-explicit-any */
import { RequestCollectionUseCase } from "../src/modules/collections/application/use-cases/request-collection.use-case";
import { AssignCollectionUseCase } from "../src/modules/collections/application/use-cases/assign-collection.use-case";
import { CompleteCollectionUseCase } from "../src/modules/collections/application/use-cases/complete-collection.use-case";
import { ListCollectionsUseCase } from "../src/modules/collections/application/use-cases/list-collections.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { CollectionStatus, ParcelStatus, ShipmentStatus } from "@prisma/client";
import { ForbiddenException } from "@nestjs/common";

describe("Phase 7 Backend Tests: Collection Workflow & Automated Shipment Creation (Phase 4 Reuse)", () => {
  let requestUseCase: RequestCollectionUseCase;
  let assignUseCase: AssignCollectionUseCase;
  let completeUseCase: CompleteCollectionUseCase;
  let listUseCase: ListCollectionsUseCase;
  let mockPrisma: any;
  let mockCreateShipmentUseCase: any;
  let mockEventBus: any;

  const CASA_AGENCY_ID = "ag-casa-111";
  const RABAT_AGENCY_ID = "ag-rabat-222";
  const CUSTOMER_A_ID = "cust-alpha-uuid";
  const CUSTOMER_B_ID = "cust-beta-uuid";

  const customerUserA: AuthenticatedUser = {
    id: "user-client-a",
    email: "contact@alphashop.ma",
    firstName: "Amine",
    lastName: "Client",
    role: "CUSTOMER",
    customerId: CUSTOMER_A_ID,
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:create", "collections:read"],
    isGlobalScope: false,
  };

  const customerUserB: AuthenticatedUser = {
    id: "user-client-b",
    email: "contact@betashop.ma",
    firstName: "Sofia",
    lastName: "ClientB",
    role: "CUSTOMER",
    customerId: CUSTOMER_B_ID,
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:create", "collections:read"],
    isGlobalScope: false,
  };

  const dispatcherUser: AuthenticatedUser = {
    id: "user-dispatch",
    email: "dispatch.casablanca@hes.ma",
    firstName: "Mehdi",
    lastName: "Dispatch",
    role: "AGENT",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:manage", "collections:read"],
    isGlobalScope: false,
  };

  const courierUser: AuthenticatedUser = {
    id: "user-courier-1",
    email: "courier.rachid@hes.ma",
    firstName: "Rachid",
    lastName: "Coursier",
    role: "COURIER",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:read", "collections:complete"],
    isGlobalScope: false,
  };

  const otherCourierUser: AuthenticatedUser = {
    id: "user-courier-2",
    email: "courier.omar@hes.ma",
    firstName: "Omar",
    lastName: "Coursier2",
    role: "COURIER",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:read", "collections:complete"],
    isGlobalScope: false,
  };

  // In-memory collections state
  let collectionsRecord: any[];
  let collectionItemsRecord: any[];
  let shipmentsRecord: any[];
  let parcelsRecord: any[];
  let trackingEventsRecord: any[];

  beforeEach(() => {
    collectionsRecord = [];
    collectionItemsRecord = [];
    shipmentsRecord = [];
    parcelsRecord = [];
    trackingEventsRecord = [];

    mockPrisma = {
      customer: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === CUSTOMER_A_ID) {
            return {
              id: CUSTOMER_A_ID,
              agencyId: CASA_AGENCY_ID,
              name: "Alpha Shop",
              agency: { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Agency" },
            };
          }
          if (where.id === CUSTOMER_B_ID) {
            return {
              id: CUSTOMER_B_ID,
              agencyId: CASA_AGENCY_ID,
              name: "Beta Shop",
              agency: { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Agency" },
            };
          }
          return null;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where.email === customerUserA.email) {
            return {
              id: CUSTOMER_A_ID,
              agencyId: CASA_AGENCY_ID,
              agency: { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Agency" },
            };
          }
          return null;
        }),
      },
      agency: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === CASA_AGENCY_ID) {
            return { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Agency", city: "Casablanca" };
          }
          if (where.id === RABAT_AGENCY_ID) {
            return { id: RABAT_AGENCY_ID, code: "RAB", name: "Rabat Agency", city: "Rabat" };
          }
          return null;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where.city?.contains === "Rabat") {
            return { id: RABAT_AGENCY_ID, code: "RAB", name: "Rabat Agency", city: "Rabat" };
          }
          return { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Agency", city: "Casablanca" };
        }),
      },
      address: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      parcelType: {
        findFirst: jest.fn().mockResolvedValue({
          id: "pt-colis-standard",
          code: "STANDARD_PARCEL",
          name: "Colis Standard",
          isActive: true,
        }),
      },
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === courierUser.id) {
            return {
              id: courierUser.id,
              agencyId: CASA_AGENCY_ID,
              isActive: true,
              role: { code: "COURIER" },
            };
          }
          if (where.id === otherCourierUser.id) {
            return {
              id: otherCourierUser.id,
              agencyId: CASA_AGENCY_ID,
              isActive: true,
              role: { code: "COURIER" },
            };
          }
          return null;
        }),
      },
      collection: {
        count: jest.fn().mockImplementation(async () => collectionsRecord.length),
        create: jest.fn().mockImplementation(async ({ data }) => {
          const coll = {
            id: `col-${Date.now()}-${Math.random()}`,
            ...data,
            items: [],
          };
          collectionsRecord.push(coll);
          return coll;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const c = collectionsRecord.find((item) => item.id === where.id);
          if (!c) return null;
          return {
            ...c,
            customer: {
              id: c.customerId,
              agencyId: c.agencyId,
            },
            agency: {
              id: c.agencyId,
              code: "CAS",
              name: "Casablanca Agency",
            },
            items: collectionItemsRecord.filter((item) => item.collectionId === c.id),
          };
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = collectionsRecord.findIndex((c) => c.id === where.id);
          if (idx !== -1) {
            collectionsRecord[idx] = { ...collectionsRecord[idx], ...data };
            return collectionsRecord[idx];
          }
          return null;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return collectionsRecord.filter((c) => {
            if (where.customerId && c.customerId !== where.customerId)
              return false;
            if (
              where.assignedCourierId &&
              c.assignedCourierId !== where.assignedCourierId
            )
              return false;
            if (where.agencyId && c.agencyId !== where.agencyId) return false;
            return true;
          });
        }),
      },
      collectionItem: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const item = { id: `ci-${Date.now()}-${Math.random()}`, ...data };
          collectionItemsRecord.push(item);
          return item;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = collectionItemsRecord.findIndex(
            (ci) => ci.id === where.id,
          );
          if (idx !== -1) {
            collectionItemsRecord[idx] = {
              ...collectionItemsRecord[idx],
              ...data,
            };
            return collectionItemsRecord[idx];
          }
          return null;
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
      },
      trackingEvent: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const evt = { id: `evt-${Date.now()}`, ...data };
          trackingEventsRecord.push(evt);
          return evt;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    // Spy / mock for CreateShipmentUseCase (Phase 4 reuse)
    mockCreateShipmentUseCase = {
      execute: jest.fn().mockImplementation(async (dto, user) => {
        const shipmentId = "shipment-gen-uuid";
        const trackingNumber = "HES-CAS-2026-000042";
        const parcels = dto.parcels.map((p: any, idx: number) => {
          const parcelObj = {
            id: `parcel-gen-${idx + 1}`,
            shipmentId,
            trackingNumber: `${trackingNumber}-0${idx + 1}`,
            parcelIndex: idx + 1,
            weightKg: p.weightKg,
            status: ParcelStatus.REGISTERED,
            currentAgencyId: dto.originAgencyId,
          };
          parcelsRecord.push(parcelObj);
          return parcelObj;
        });

        const createdShipment = {
          id: shipmentId,
          number: trackingNumber,
          trackingNumber,
          originAgencyId: dto.originAgencyId,
          destinationAgencyId: dto.destinationAgencyId,
          senderCustomerId: dto.senderCustomerId,
          recipientName: dto.recipientName,
          recipientCity: dto.recipientCity,
          globalStatus: ShipmentStatus.IN_TRANSIT,
          totalParcels: parcels.length,
          totalWeightKg: dto.parcels.reduce((s: number, p: any) => s + p.weightKg, 0),
          parcels,
        };
        shipmentsRecord.push(createdShipment);
        return createdShipment;
      }),
    };

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    requestUseCase = new RequestCollectionUseCase(mockPrisma);
    assignUseCase = new AssignCollectionUseCase(mockPrisma);
    completeUseCase = new CompleteCollectionUseCase(
      mockPrisma,
      mockCreateShipmentUseCase,
      mockEventBus,
    );
    listUseCase = new ListCollectionsUseCase(mockPrisma);
  });

  it("Full Workflow: Request -> Assign -> Complete triggers automated Shipment creation and publishes CollectionCompleted", async () => {
    // 1. Client A requests collection
    const requestDto = {
      pickupContactName: "Fatima Zahra",
      pickupPhone: "+212611223344",
      pickupStreet: "45 Rue des Alouettes, Maarif",
      pickupCity: "Casablanca",
      scheduledDate: "2026-09-03",
      timeSlotStart: "09:00",
      timeSlotEnd: "12:00",
      items: [
        {
          declaredWeightKg: 2.0,
          description: "Articles cosmétiques",
          recipientName: "Yassine Mansouri",
          recipientPhone: "+212677889900",
          recipientAddress: "Avenue Allal Ben Abdellah",
          recipientCity: "Rabat",
          codAmount: 350.0,
        },
        {
          declaredWeightKg: 1.5,
          description: "Huiles d'argan",
          recipientName: "Khadija Alami",
          recipientPhone: "+212655443322",
          recipientAddress: "Hay Riad",
          recipientCity: "Rabat",
          codAmount: 180.0,
        },
      ],
    };

    const createdCollection = await requestUseCase.execute(
      requestDto,
      customerUserA,
    );
    expect(createdCollection.status).toBe(CollectionStatus.REQUESTED);
    expect(createdCollection.collectionNumber).toMatch(/^COL-CAS-\d{4}-\d{5}$/);
    expect(createdCollection.customerId).toBe(CUSTOMER_A_ID);
    expect(collectionItemsRecord).toHaveLength(2);

    // 2. Dispatcher assigns collection to Courier Rachid
    const assignedCollection = await assignUseCase.execute(
      createdCollection.id,
      { courierId: courierUser.id },
      dispatcherUser,
    );
    expect(assignedCollection.status).toBe(CollectionStatus.ASSIGNED);
    expect(assignedCollection.assignedCourierId).toBe(courierUser.id);

    // 3. Courier Rachid completes collection on-site with actual weighed parcels
    const completeDto = {
      driverNotes: "Enlèvement réalisé sans incident, emballages conformes",
      items: [
        {
          itemIndex: 1,
          actualWeightKg: 2.2, // Weighed slightly higher
          recipientName: "Yassine Mansouri",
          recipientPhone: "+212677889900",
          recipientAddress: "Avenue Allal Ben Abdellah",
          recipientCity: "Rabat",
          codAmount: 350.0,
        },
        {
          itemIndex: 2,
          actualWeightKg: 1.6,
          recipientName: "Khadija Alami",
          recipientPhone: "+212655443322",
          recipientAddress: "Hay Riad",
          recipientCity: "Rabat",
          codAmount: 180.0,
        },
      ],
    };

    const completionResult = await completeUseCase.execute(
      createdCollection.id,
      completeDto,
      courierUser,
    );

    // Assert Collection is COMPLETED
    expect(completionResult.collection.status).toBe(CollectionStatus.COMPLETED);
    expect(completionResult.collection.generatedShipmentId).toBe(
      "shipment-gen-uuid",
    );
    expect(completionResult.parcelsCount).toBe(2);
    expect(completionResult.totalWeightKg).toBeCloseTo(3.8, 1);

    // Assert Shipment was automatically created
    expect(shipmentsRecord).toHaveLength(1);
    const shipment = shipmentsRecord[0];
    expect(shipment.trackingNumber).toBe("HES-CAS-2026-000042");
    expect(shipment.senderCustomerId).toBe(CUSTOMER_A_ID);
    expect(shipment.recipientName).toBe("Yassine Mansouri");
    expect(shipment.recipientCity).toBe("Rabat");
    expect(shipment.totalParcels).toBe(2);
    expect(shipment.totalWeightKg).toBeCloseTo(3.8, 1);

    // Assert 2 Parcels were transitioned to status PICKED_UP
    expect(parcelsRecord).toHaveLength(2);
    expect(parcelsRecord[0].trackingNumber).toBe("HES-CAS-2026-000042-01");
    expect(parcelsRecord[0].status).toBe(ParcelStatus.PICKED_UP);
    expect(parcelsRecord[0].currentAgencyId).toBe(CASA_AGENCY_ID);
    expect(parcelsRecord[0].weightKg).toBe(2.2);

    expect(parcelsRecord[1].trackingNumber).toBe("HES-CAS-2026-000042-02");
    expect(parcelsRecord[1].status).toBe(ParcelStatus.PICKED_UP);

    // Assert TrackingEvents generated
    expect(trackingEventsRecord).toHaveLength(2);
    expect(
      trackingEventsRecord.every((e) => e.status === ParcelStatus.PICKED_UP),
    ).toBe(true);

    // Assert EventBus published CollectionCompleted
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "CollectionCompleted",
        payload: expect.objectContaining({
          collectionNumber: createdCollection.collectionNumber,
          generatedShipmentId: "shipment-gen-uuid",
          shipmentTrackingNumber: "HES-CAS-2026-000042",
          parcelsCount: 2,
          totalActualWeightKg: 3.8,
        }),
      }),
    );
  });

  it("Anti-Duplication Verification: CompleteCollection explicitly delegates to Phase 4 CreateShipmentUseCase without duplicating sequence/validation", async () => {
    // Setup requested collection assigned to Rachid
    const col = await mockPrisma.collection.create({
      data: {
        number: "COL-CAS-2026-00088",
        collectionNumber: "COL-CAS-2026-00088",
        customerId: CUSTOMER_A_ID,
        agencyId: CASA_AGENCY_ID,
        status: CollectionStatus.ASSIGNED,
        assignedCourierId: courierUser.id,
      },
    });

    await completeUseCase.execute(
      col.id,
      {
        driverNotes: "Enlèvement direct",
        items: [
          {
            itemIndex: 1,
            actualWeightKg: 3.5,
            recipientName: "Omar Tazi",
            recipientPhone: "+212600112233",
            recipientAddress: "Boulevard Zerktouni",
            recipientCity: "Casablanca",
          },
        ],
      },
      courierUser,
    );

    // Verify spy was called exactly once with the standardized CreateShipmentDto
    expect(mockCreateShipmentUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mockCreateShipmentUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        originAgencyId: CASA_AGENCY_ID,
        senderCustomerId: CUSTOMER_A_ID,
        recipientName: "Omar Tazi",
        parcels: expect.arrayContaining([
          expect.objectContaining({
            weightKg: 3.5,
          }),
        ]),
      }),
      courierUser,
    );
  });

  it("Security Isolation: Client A only sees their own collections, cannot see Client B's", async () => {
    // Insert collection for Client A
    collectionsRecord.push({
      id: "col-a",
      collectionNumber: "COL-CAS-2026-00001",
      customerId: CUSTOMER_A_ID,
      agencyId: CASA_AGENCY_ID,
      scheduledDate: new Date(),
      status: CollectionStatus.REQUESTED,
      deletedAt: null,
    });

    // Insert collection for Client B
    collectionsRecord.push({
      id: "col-b",
      collectionNumber: "COL-CAS-2026-00002",
      customerId: CUSTOMER_B_ID,
      agencyId: CASA_AGENCY_ID,
      scheduledDate: new Date(),
      status: CollectionStatus.REQUESTED,
      deletedAt: null,
    });

    // Query as Client A
    const listA = await listUseCase.execute({}, customerUserA);
    expect(listA.data).toHaveLength(1);
    expect(listA.data[0].id).toBe("col-a");
    expect(listA.data.some((c) => c.customerId === CUSTOMER_B_ID)).toBe(false);

    // Query as Client B
    const listB = await listUseCase.execute({}, customerUserB);
    expect(listB.data).toHaveLength(1);
    expect(listB.data[0].id).toBe("col-b");
    expect(listB.data.some((c) => c.customerId === CUSTOMER_A_ID)).toBe(false);
  });

  it("Security Isolation: Courier cannot complete a mission assigned to another courier", async () => {
    // Collection assigned to Courier 1 (Rachid)
    collectionsRecord.push({
      id: "col-assigned-to-rachid",
      collectionNumber: "COL-CAS-2026-00099",
      customerId: CUSTOMER_A_ID,
      agencyId: CASA_AGENCY_ID,
      status: CollectionStatus.ASSIGNED,
      assignedCourierId: courierUser.id,
      items: [],
      deletedAt: null,
    });

    // Courier 2 (Omar) tries to complete Rachid's collection
    await expect(
      completeUseCase.execute(
        "col-assigned-to-rachid",
        { items: [{ itemIndex: 1, actualWeightKg: 2.0 }] },
        otherCourierUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
