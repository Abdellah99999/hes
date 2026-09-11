/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProcessTrackingEventUseCase } from "../src/modules/shipments/application/use-cases/process-tracking-event.use-case";
import { BarcodeService } from "../src/modules/shipments/domain/barcode.service";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { ParcelStatus, TrackingEventSource } from "@prisma/client";

describe("Phase 5 Backend Tests: Terminal States & Manual Change Security", () => {
  let useCase: ProcessTrackingEventUseCase;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockRedisService: any;
  let barcodeService: BarcodeService;

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
    permissions: ["shipments:update", "shipments:read"],
    isGlobalScope: false,
  };

  beforeEach(() => {
    barcodeService = new BarcodeService();

    mockPrisma = {
      parcel: {
        findFirst: jest.fn(),
      },
      trackingEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {
          scan: { create: jest.fn().mockResolvedValue({ id: "scan-1" }) },
          trackingEvent: {
            create: jest.fn().mockImplementation(async ({ data }) => ({
              id: "event-1",
              ...data,
            })),
          },
          parcel: {
            update: jest.fn().mockImplementation(async ({ data }) => ({
              id: "parcel-1",
              status: data.status,
            })),
            findMany: jest.fn().mockResolvedValue([{ status: "DELIVERED" }]),
          },
          shipment: {
            update: jest.fn().mockResolvedValue({ id: "shipment-1" }),
          },
        };
        return callback(txMock);
      }),
    };

    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(null),
    };

    useCase = new ProcessTrackingEventUseCase(
      mockPrisma,
      mockAuditService,
      mockRedisService,
      barcodeService,
    );
  });

  it("should throw NotFoundException if parcel does not exist or has been soft-deleted", async () => {
    mockPrisma.parcel.findFirst.mockResolvedValueOnce(null);

    await expect(
      useCase.executeScan(
        { barcode: "HES-UNKNOWN-2026-999999-01" },
        operatorUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("should explicitly REJECT scans on terminal states (DELIVERED, RETURNED, CANCELLED)", async () => {
    const terminalStates = [
      ParcelStatus.DELIVERED,
      ParcelStatus.RETURNED,
      ParcelStatus.CANCELLED,
      ParcelStatus.LOST,
      ParcelStatus.DAMAGED,
    ];

    for (const terminal of terminalStates) {
      mockPrisma.parcel.findFirst.mockResolvedValueOnce({
        id: `parcel-terminal-${terminal}`,
        trackingNumber: `HES-CAS-2026-000001-01`,
        status: terminal,
        deletedAt: null,
        shipment: {
          id: "ship-1",
          originAgencyId: CASA_AGENCY_ID,
          destinationAgencyId: "agency-2",
        },
      });

      await expect(
        useCase.executeScan(
          {
            barcode: "HES-CAS-2026-000001-01",
            targetStatus: ParcelStatus.IN_TRANSIT,
          },
          operatorUser,
        ),
      ).rejects.toThrow(BadRequestException);
    }
  });

  it("should enforce mandatory notes on manual status change and set source to MANUAL", async () => {
    mockPrisma.parcel.findFirst.mockResolvedValueOnce({
      id: "parcel-manual-1",
      trackingNumber: "HES-CAS-2026-000001-01",
      status: ParcelStatus.REGISTERED,
      deletedAt: null,
      shipment: {
        id: "ship-1",
        originAgencyId: CASA_AGENCY_ID,
        destinationAgencyId: "agency-2",
      },
    });

    const result = await useCase.executeManual(
      {
        trackingNumberOrId: "HES-CAS-2026-000001-01",
        status: ParcelStatus.PICKED_UP,
        notes:
          "Prise en charge manuelle suite à panne temporaire du lecteur optique",
      },
      operatorUser,
    );

    expect(result.source).toBe(TrackingEventSource.MANUAL);
    expect(result.trackingEvent?.notes).toContain("panne temporaire");
    expect(mockAuditService.logEvent).toHaveBeenCalled();
  });
});
