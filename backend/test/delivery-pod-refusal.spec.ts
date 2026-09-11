/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfirmDeliveryUseCase } from "../src/modules/deliveries/application/use-cases/confirm-delivery.use-case";
import { RecordRefusalUseCase } from "../src/modules/deliveries/application/use-cases/record-refusal.use-case";
import { RegisterDeferredPodUseCase } from "../src/modules/deliveries/application/use-cases/register-deferred-pod.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import {
  ParcelStatus,
  ShipmentStatus,
  ProofType,
  RefusalReasonCode,
} from "@prisma/client";
import { BadRequestException } from "@nestjs/common";

describe("Phase 9 Backend Tests: POD, Refusal Automation & '3 Parcels: 2 Delivered, 1 Refused' Scenario", () => {
  let confirmDeliveryUseCase: ConfirmDeliveryUseCase;
  let recordRefusalUseCase: RecordRefusalUseCase;
  let registerDeferredPodUseCase: RegisterDeferredPodUseCase;
  let mockPrisma: any;
  let mockEventBus: any;

  const CASA_AGENCY_ID = "ag-casa-uuid-111";
  const SHIPMENT_ID = "shipment-multi-3parcels";

  const courierUser: AuthenticatedUser = {
    id: "user-courier-rachid",
    email: "rachid@hes.ma",
    firstName: "Rachid",
    lastName: "Livreur",
    role: "COURIER",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["deliveries:confirm", "deliveries:refuse"],
    isGlobalScope: false,
  };

  const agencyOperatorUser: AuthenticatedUser = {
    id: "user-operator-fatima",
    email: "fatima.quai@hes.ma",
    firstName: "Fatima",
    lastName: "AgentQuai",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["deliveries:manage"],
    isGlobalScope: false,
  };

  let parcelsRecord: any[];
  let shipmentRecord: any;
  let deliveryAttemptsRecord: any[];
  let deliveryProofsRecord: any[];
  let trackingEventsRecord: any[];
  let runItemRecords: any[];

  beforeEach(() => {
    deliveryAttemptsRecord = [];
    deliveryProofsRecord = [];
    trackingEventsRecord = [];
    runItemRecords = [];

    // Shipment with 3 parcels initially OUT_FOR_DELIVERY
    shipmentRecord = {
      id: SHIPMENT_ID,
      trackingNumber: "HES-CAS-2026-000099",
      originAgencyId: CASA_AGENCY_ID,
      destinationAgencyId: CASA_AGENCY_ID,
      globalStatus: ShipmentStatus.OUT_FOR_DELIVERY,
      totalParcels: 3,
      parcels: [],
    };

    parcelsRecord = [
      {
        id: "parcel-1",
        shipmentId: SHIPMENT_ID,
        trackingNumber: "HES-CAS-2026-000099-01",
        status: ParcelStatus.OUT_FOR_DELIVERY,
        currentAgencyId: CASA_AGENCY_ID,
        weightKg: 2.0,
        shipment: shipmentRecord,
      },
      {
        id: "parcel-2",
        shipmentId: SHIPMENT_ID,
        trackingNumber: "HES-CAS-2026-000099-02",
        status: ParcelStatus.OUT_FOR_DELIVERY,
        currentAgencyId: CASA_AGENCY_ID,
        weightKg: 1.5,
        shipment: shipmentRecord,
      },
      {
        id: "parcel-3",
        shipmentId: SHIPMENT_ID,
        trackingNumber: "HES-CAS-2026-000099-03",
        status: ParcelStatus.OUT_FOR_DELIVERY,
        currentAgencyId: CASA_AGENCY_ID,
        weightKg: 3.0,
        shipment: shipmentRecord,
      },
    ];

    shipmentRecord.parcels = parcelsRecord;

    mockPrisma = {
      parcel: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const p = parcelsRecord.find((item) => item.id === where.id);
          if (!p) return null;
          return {
            ...p,
            shipment: {
              ...shipmentRecord,
              parcels: parcelsRecord,
            },
          };
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const p = parcelsRecord.find(
            (item) =>
              item.id === where.OR?.[0]?.id ||
              item.trackingNumber === where.OR?.[1]?.trackingNumber,
          );
          if (!p) return null;
          return {
            ...p,
            shipment: {
              ...shipmentRecord,
              parcels: parcelsRecord,
            },
          };
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
      shipment: {
        update: jest.fn().mockImplementation(async ({ data }) => {
          shipmentRecord = { ...shipmentRecord, ...data };
          return shipmentRecord;
        }),
      },
      deliveryRunItem: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return (
            runItemRecords.find((r) => r.parcelId === where.parcelId) || null
          );
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = runItemRecords.findIndex((r) => r.id === where.id);
          if (idx !== -1) {
            runItemRecords[idx] = { ...runItemRecords[idx], ...data };
            return runItemRecords[idx];
          }
          return null;
        }),
      },
      deliveryRun: {
        update: jest.fn().mockResolvedValue({}),
      },
      refusalReason: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return {
            id: `refusal-${where.code}`,
            code: where.code,
            labelFr: where.code,
          };
        }),
        create: jest.fn().mockImplementation(async ({ data }) => {
          return { id: `refusal-${data.code}`, ...data };
        }),
      },
      deliveryAttempt: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const attempt = {
            id: `attempt-${Date.now()}-${Math.random()}`,
            ...data,
            attemptedAt: new Date(),
          };
          deliveryAttemptsRecord.push(attempt);
          return attempt;
        }),
      },
      deliveryProof: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const proof = {
            id: `proof-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          deliveryProofsRecord.push(proof);
          return proof;
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

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    confirmDeliveryUseCase = new ConfirmDeliveryUseCase(
      mockPrisma,
      mockEventBus,
    );
    recordRefusalUseCase = new RecordRefusalUseCase(
      mockPrisma,
      mockEventBus,
    );
    registerDeferredPodUseCase = new RegisterDeferredPodUseCase(
      mockPrisma,
      mockEventBus,
    );
  });

  it("Scenario: 3 Parcels -> 2 Delivered, 1 Refused (calculates PARTIALLY_DELIVERED, triggers RETURNED, and publishes events exactly once)", async () => {
    // 1. Deliver Parcel 1 with digital signature POD
    const res1 = await confirmDeliveryUseCase.execute(
      "parcel-1",
      {
        proofType: ProofType.DIGITAL_SIGNATURE,
        recipientName: "Yassine Mansouri",
        signatureDataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        collectedCodAmount: 250.0,
      },
      courierUser,
    );

    expect(res1.parcel.status).toBe(ParcelStatus.DELIVERED);
    expect(res1.proof.proofType).toBe(ProofType.DIGITAL_SIGNATURE);
    // At this stage, 1 DELIVERED, 2 OUT_FOR_DELIVERY -> PARTIALLY_DELIVERED
    expect(res1.globalShipmentStatus).toBe(ShipmentStatus.PARTIALLY_DELIVERED);

    // Verify first event published
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "DeliveryCompleted",
        payload: expect.objectContaining({
          parcelId: "parcel-1",
          recipientName: "Yassine Mansouri",
          proofType: ProofType.DIGITAL_SIGNATURE,
          collectedCodAmount: 250.0,
        }),
      }),
    );

    // 2. Deliver Parcel 2 with paper POD photo
    const res2 = await confirmDeliveryUseCase.execute(
      "parcel-2",
      {
        proofType: ProofType.PAPER_POD_PHOTO,
        recipientName: "Yassine Mansouri",
        podPhotoStorageKey: "pod/bl-signed-002.jpg",
      },
      courierUser,
    );
    expect(res2.parcel.status).toBe(ParcelStatus.DELIVERED);
    expect(res2.globalShipmentStatus).toBe(ShipmentStatus.PARTIALLY_DELIVERED);

    // Verify second event published
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "DeliveryCompleted",
        payload: expect.objectContaining({
          parcelId: "parcel-2",
          recipientName: "Yassine Mansouri",
          proofType: ProofType.PAPER_POD_PHOTO,
        }),
      }),
    );

    // 3. Destinataire refuses Parcel 3 (damaged package) -> Triggers automatic RETURN
    const res3 = await recordRefusalUseCase.execute(
      "parcel-3",
      {
        reasonCode: RefusalReasonCode.DAMAGED_PACKAGE,
        courierNotes:
          "Carton perforé, liquide renversé, refus immédiat de l'acheteur",
      },
      courierUser,
    );

    // Parcel 3 status transitions immediately to RETURNED
    expect(res3.parcel.status).toBe(ParcelStatus.RETURNED);
    expect(res3.refusalReason).toBe(RefusalReasonCode.DAMAGED_PACKAGE);

    // Final mathematical evaluation: [DELIVERED, DELIVERED, RETURNED] -> PARTIALLY_DELIVERED
    expect(res3.globalShipmentStatus).toBe(ShipmentStatus.PARTIALLY_DELIVERED);

    // Verify DeliveryFailed event published with return trigger
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "DeliveryFailed",
        payload: expect.objectContaining({
          parcelId: "parcel-3",
          refusalReasonCode: RefusalReasonCode.DAMAGED_PACKAGE,
          isRefusal: true,
          triggersReturn: true,
        }),
      }),
    );

    // 🆕 CRITICAL REQUIREMENT: Exactly ONE event published per confirmed delivery (2 deliveries = 2 DeliveryCompleted events)
    const completedEvents = mockEventBus.publish.mock.calls.filter(
      ([evt]: any) => evt.eventName === "DeliveryCompleted",
    );
    expect(completedEvents).toHaveLength(2);

    const failedEvents = mockEventBus.publish.mock.calls.filter(
      ([evt]: any) => evt.eventName === "DeliveryFailed",
    );
    expect(failedEvents).toHaveLength(1);

    // Verify tracking events recorded
    expect(trackingEventsRecord).toHaveLength(3);
    const returnEvt = trackingEventsRecord.find(
      (e) => e.parcelId === "parcel-3",
    );
    expect(returnEvt?.status).toBe(ParcelStatus.RETURNED);
    expect(returnEvt?.notes).toContain("DAMAGED_PACKAGE");
  });

  it("Security & POD Enforcement: Confirming delivery without POD is strictly rejected", async () => {
    // Missing recipientName
    await expect(
      confirmDeliveryUseCase.execute(
        "parcel-1",
        {
          proofType: ProofType.DIGITAL_SIGNATURE,
          recipientName: "",
          signatureDataUrl: "data:image/svg...",
        },
        courierUser,
      ),
    ).rejects.toThrow(BadRequestException);

    // Missing signature for DIGITAL_SIGNATURE
    await expect(
      confirmDeliveryUseCase.execute(
        "parcel-1",
        {
          proofType: ProofType.DIGITAL_SIGNATURE,
          recipientName: "Khadija Alami",
          signatureDataUrl: "",
        },
        courierUser,
      ),
    ).rejects.toThrow(BadRequestException);

    // Missing photo key for PAPER_POD_PHOTO
    await expect(
      confirmDeliveryUseCase.execute(
        "parcel-1",
        {
          proofType: ProofType.PAPER_POD_PHOTO,
          recipientName: "Khadija Alami",
          podPhotoStorageKey: "",
        },
        courierUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("Deferred Paper POD: Agency staff can register physical stamped slip returned at hub and event is published", async () => {
    const deferredRes = await registerDeferredPodUseCase.execute(
      "parcel-1",
      {
        recipientName: "Société Maroc Télécom (Tampon Réception)",
        podPhotoStorageKey: "pod/stamped-slip-001.pdf",
        recipientCin: "A112233",
        agentNotes: "BL papier vérifié conforme au guichet quai",
      },
      agencyOperatorUser,
    );

    expect(deferredRes.parcel.status).toBe(ParcelStatus.DELIVERED);
    expect(deferredRes.proof.isDeferredScan).toBe(true);
    expect(deferredRes.proof.registeredByUserId).toBe(agencyOperatorUser.id);

    // Verify event published
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "DeliveryCompleted",
        payload: expect.objectContaining({
          parcelId: "parcel-1",
          isDeferredScan: true,
          registeredByUserId: agencyOperatorUser.id,
        }),
      }),
    );
  });
});
