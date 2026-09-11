/* eslint-disable @typescript-eslint/no-explicit-any */
import { GetTrackingTimelineUseCase } from "../src/modules/shipments/application/use-cases/get-tracking-timeline.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { TrackingEventSource, ParcelStatus } from "@prisma/client";

describe("Phase 5 Backend Tests: Tracking Timeline Chronological Reconstruction", () => {
  let useCase: GetTrackingTimelineUseCase;
  let mockPrisma: any;

  const CASA_AGENCY_ID = "agency-casa-uuid-1111";

  const operatorUser: AuthenticatedUser = {
    id: "user-op-casa-1",
    email: "operator.casa@hes.ma",
    firstName: "Amine",
    lastName: "Tazi",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["shipments:read"],
    isGlobalScope: false,
  };

  const sampleShipment = {
    id: "shipment-uuid-1",
    trackingNumber: "HES-CAS-2026-000042",
    globalStatus: "IN_TRANSIT",
    originAgencyId: CASA_AGENCY_ID,
    destinationAgencyId: "agency-aga-2222",
    recipientName: "Ahmed Mansouri",
    recipientCity: "Agadir",
    totalParcels: 2,
    originAgency: { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Hub" },
    destinationAgency: {
      id: "agency-aga-2222",
      code: "AGA",
      name: "Agadir Agency",
    },
  };

  const sampleEvents = [
    {
      id: "evt-1",
      shipmentId: sampleShipment.id,
      parcelId: "parcel-1",
      source: TrackingEventSource.SYSTEM,
      status: ParcelStatus.REGISTERED,
      previousStatus: null,
      createdAt: new Date("2026-09-02T08:00:00Z"),
      notes: "Bordereau créé dans le système",
      agency: sampleShipment.originAgency,
      user: null,
      parcel: {
        id: "parcel-1",
        parcelIndex: 1,
        trackingNumber: "HES-CAS-2026-000042-01",
      },
      scan: null,
    },
    {
      id: "evt-2",
      shipmentId: sampleShipment.id,
      parcelId: "parcel-1",
      source: TrackingEventSource.SCAN,
      status: ParcelStatus.PICKED_UP,
      previousStatus: ParcelStatus.REGISTERED,
      createdAt: new Date("2026-09-02T10:15:00Z"),
      notes: "Scan physique enregistré",
      agency: sampleShipment.originAgency,
      user: {
        id: "user-1",
        firstName: "Karim",
        lastName: "Chauffeur",
        email: "chauffeur@hes.ma",
      },
      parcel: {
        id: "parcel-1",
        parcelIndex: 1,
        trackingNumber: "HES-CAS-2026-000042-01",
      },
      scan: {
        id: "scan-1",
        rawBarcode: "HES-CAS-2026-000042-01",
        scannerType: "BARCODE_1D",
      },
    },
    {
      id: "evt-3",
      shipmentId: sampleShipment.id,
      parcelId: "parcel-1",
      source: TrackingEventSource.MANUAL,
      status: ParcelStatus.AT_HUB,
      previousStatus: ParcelStatus.PICKED_UP,
      createdAt: new Date("2026-09-02T14:30:00Z"),
      notes: "Saisie manuelle après déchargement quai",
      agency: sampleShipment.originAgency,
      user: {
        id: operatorUser.id,
        firstName: "Amine",
        lastName: "Tazi",
        email: operatorUser.email,
      },
      parcel: {
        id: "parcel-1",
        parcelIndex: 1,
        trackingNumber: "HES-CAS-2026-000042-01",
      },
      scan: null,
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      shipment: {
        findFirst: jest.fn().mockResolvedValue(sampleShipment),
      },
      parcel: {
        findFirst: jest.fn().mockResolvedValue({
          id: "parcel-1",
          trackingNumber: "HES-CAS-2026-000042-01",
          shipment: sampleShipment,
        }),
      },
      trackingEvent: {
        findMany: jest.fn().mockResolvedValue(sampleEvents),
      },
    };

    useCase = new GetTrackingTimelineUseCase(mockPrisma);
  });

  it("should reconstruct exact chronological timeline for shipment", async () => {
    const timeline = await useCase.executeByShipment(
      sampleShipment.id,
      operatorUser,
    );

    expect(timeline.shipment.trackingNumber).toBe("HES-CAS-2026-000042");
    expect(timeline.eventsCount).toBe(3);
    expect(timeline.events).toHaveLength(3);

    // Verify chronological order
    expect(timeline.events[0].status).toBe(ParcelStatus.REGISTERED);
    expect(timeline.events[0].source).toBe("SYSTEM");

    expect(timeline.events[1].status).toBe(ParcelStatus.PICKED_UP);
    expect(timeline.events[1].source).toBe("SCAN");
    expect(timeline.events[1].scan?.scannerType).toBe("BARCODE_1D");

    expect(timeline.events[2].status).toBe(ParcelStatus.AT_HUB);
    expect(timeline.events[2].source).toBe("MANUAL");
    expect(timeline.events[2].notes).toContain("Saisie manuelle");
    expect(timeline.events[2].operator?.name).toBe("Amine Tazi");
  });

  it("should reconstruct timeline filtered by individual parcel", async () => {
    const timeline = await useCase.executeByParcel("parcel-1", operatorUser);

    expect(timeline.filterParcelId).toBe("parcel-1");
    expect(timeline.eventsCount).toBe(3);
    expect(mockPrisma.trackingEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parcelId: "parcel-1" },
        orderBy: { createdAt: "asc" },
      }),
    );
  });
});
