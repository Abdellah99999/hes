/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessTrackingEventUseCase } from "../src/modules/shipments/application/use-cases/process-tracking-event.use-case";
import { BarcodeService } from "../src/modules/shipments/domain/barcode.service";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { ParcelStatus, TrackingEventSource } from "@prisma/client";
import { ScannerType } from "../src/modules/shipments/dto/scan-barcode.dto";

describe("Phase 5 Backend Tests: Scan Idempotency & Deduplication Engine", () => {
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

  const mockParcel = {
    id: "parcel-uuid-001",
    shipmentId: "shipment-uuid-100",
    trackingNumber: "HES-CAS-2026-000042-01",
    parcelIndex: 1,
    status: ParcelStatus.REGISTERED,
    deletedAt: null,
    shipment: {
      id: "shipment-uuid-100",
      trackingNumber: "HES-CAS-2026-000042",
      originAgencyId: CASA_AGENCY_ID,
      destinationAgencyId: "agency-aga-2222",
      globalStatus: "REGISTERED",
    },
  };

  beforeEach(() => {
    barcodeService = new BarcodeService();

    // Simulated in-memory tracking events table
    const storedEvents: any[] = [];
    const storedScans: any[] = [];
    let parcelCurrentStatus = ParcelStatus.REGISTERED;

    mockPrisma = {
      parcel: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (
            where.OR?.some(
              (cond: any) =>
                cond.trackingNumber === mockParcel.trackingNumber ||
                cond.id === mockParcel.id,
            )
          ) {
            return {
              ...mockParcel,
              status: parcelCurrentStatus,
            };
          }
          return null;
        }),
      },
      trackingEvent: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          // Deduplication lookup
          return (
            storedEvents.find(
              (e) =>
                e.parcelId === where.parcelId &&
                e.status === where.status &&
                Date.now() - new Date(e.createdAt).getTime() < 60000,
            ) || null
          );
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {
          scan: {
            create: jest.fn().mockImplementation(async ({ data }) => {
              const rec = {
                id: `scan-${Date.now()}`,
                ...data,
                createdAt: new Date(),
              };
              storedScans.push(rec);
              return rec;
            }),
          },
          scanEvent: {
            create: jest.fn().mockImplementation(async ({ data }) => {
              const rec = {
                id: `scan-${Date.now()}`,
                ...data,
                createdAt: new Date(),
              };
              storedScans.push(rec);
              return rec;
            }),
          },
          trackingEvent: {
            create: jest.fn().mockImplementation(async ({ data }) => {
              const rec = {
                id: `event-${Date.now()}`,
                ...data,
                createdAt: new Date(),
              };
              storedEvents.push(rec);
              return rec;
            }),
          },
          parcel: {
            update: jest.fn().mockImplementation(async ({ data }) => {
              parcelCurrentStatus = data.status;
              return { ...mockParcel, status: parcelCurrentStatus };
            }),
            findMany: jest
              .fn()
              .mockResolvedValue([
                { id: mockParcel.id, status: parcelCurrentStatus },
              ]),
          },
          shipment: {
            update: jest.fn().mockResolvedValue({
              ...mockParcel.shipment,
              globalStatus: "IN_TRANSIT",
            }),
          },
        };
        return callback(txMock);
      }),
    };

    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(null), // Test database fallback deduplication
    };

    useCase = new ProcessTrackingEventUseCase(
      mockPrisma,
      mockAuditService,
      mockRedisService,
      barcodeService,
    );
  });

  it("should process initial physical scan and record scan and tracking event", async () => {
    const scanDto = {
      barcode: "HES-CAS-2026-000042-01",
      targetStatus: ParcelStatus.PICKED_UP,
      scannerType: ScannerType.BARCODE_1D,
      deviceId: "SCANNER-ZEBRA-01",
    };

    const result = await useCase.executeScan(scanDto, operatorUser);

    expect(result.duplicate).toBe(false);
    expect(result.source).toBe(TrackingEventSource.SCAN);
    expect(result.parcel?.status).toBe(ParcelStatus.PICKED_UP);
    expect(result.trackingEvent).toBeDefined();
    expect(result.trackingEvent?.status).toBe(ParcelStatus.PICKED_UP);
    expect(result.trackingEvent?.previousStatus).toBe(ParcelStatus.REGISTERED);
  });

  it("should detect rapid duplicate scan within 60s window and return duplicate: true with ZERO duplicate events inserted", async () => {
    const scanDto = {
      barcode: "HES-CAS-2026-000042-01",
      targetStatus: ParcelStatus.PICKED_UP,
      scannerType: ScannerType.BARCODE_1D,
    };

    // First scan: succeeds
    const firstResult = await useCase.executeScan(scanDto, operatorUser);
    expect(firstResult.duplicate).toBe(false);

    // Second rapid scan (double-beep in 100ms): same parcel, same targetStatus
    const secondResult = await useCase.executeScan(scanDto, operatorUser);

    // Assert deduplication
    expect(secondResult.duplicate).toBe(true);
    expect(secondResult.message).toContain("doublon ignoré");
    // The transaction create was called only once during the first scan
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("should respect explicit client idempotency key across retries", async () => {
    const explicitKey = "idemp-uuid-mobile-client-9999";
    const scanDto = {
      barcode: "HES-CAS-2026-000042-01",
      targetStatus: ParcelStatus.PICKED_UP,
      idempotencyKey: explicitKey,
    };

    const first = await useCase.executeScan(scanDto, operatorUser);
    expect(first.duplicate).toBe(false);
    expect(first.trackingEvent?.idempotencyKey).toBe(explicitKey);

    // Retry with exact same idempotency key
    const second = await useCase.executeScan(scanDto, operatorUser);
    expect(second.duplicate).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
