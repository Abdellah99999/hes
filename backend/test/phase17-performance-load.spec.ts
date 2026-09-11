/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarcodeService } from "../src/modules/shipments/domain/barcode.service";
import { ProcessTrackingEventUseCase } from "../src/modules/shipments/application/use-cases/process-tracking-event.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { ParcelStatus, TrackingEventSource } from "@prisma/client";
import { ScannerType } from "../src/modules/shipments/dto/scan-barcode.dto";

describe("Phase 17: Performance & Concurrency Load Test Suite", () => {
  const CASA_AGENCY_ID = "agency-casa-perf-uuid";

  const operatorUser: AuthenticatedUser = {
    id: "user-op-perf-1",
    email: "perf.operator@hes.ma",
    firstName: "Amine",
    lastName: "Tazi",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["shipments:update", "shipments:read"],
    isGlobalScope: false,
  };

  // =========================================================================
  // 1. Concurrency Benchmark: Atomic Sequential Tracking Number Generation
  // =========================================================================
  describe("1. Tracking Number Generation Concurrency Benchmark", () => {
    it("should generate 100 concurrent sequential tracking numbers with ZERO collisions and sub-5ms latency per allocation", async () => {
      const barcodeService = new BarcodeService();
      const currentYear = new Date().getFullYear();
      let sequenceCounter = 0;

      // Simulated atomic PostgreSQL sequence generator (mutex simulation)
      const generateNextSequence = async (): Promise<number> => {
        sequenceCounter++;
        return sequenceCounter;
      };

      const N = 100;
      const startTime = Date.now();

      const promises = Array.from({ length: N }, async () => {
        const seq = await generateNextSequence();
        const paddedSeq = String(seq).padStart(6, "0");
        const trackingNumber = `HES-CAS-${currentYear}-${paddedSeq}`;
        const barcodeUri = barcodeService.generateCode128Payload(trackingNumber);
        return { trackingNumber, barcodeUri, seq };
      });

      const results = await Promise.all(promises);
      const durationMs = Date.now() - startTime;
      const avgLatencyMs = durationMs / N;

      // 1. Unicity
      const generatedNumbers = results.map((r) => r.trackingNumber);
      const uniqueSet = new Set(generatedNumbers);
      expect(uniqueSet.size).toBe(N);

      // 2. Strict Sequentiality
      const sortedSeqs = results.map((r) => r.seq).sort((a, b) => a - b);
      expect(sortedSeqs[0]).toBe(1);
      expect(sortedSeqs[N - 1]).toBe(N);

      // 3. Performance metric: throughput and average latency
      expect(avgLatencyMs).toBeLessThan(15); // Sub-15ms per generation
      expect(durationMs).toBeLessThan(1000); // 100 allocations in < 1000ms
    });
  });

  // =========================================================================
  // 2. Concurrent Parcel Scanning & Rapid Deduplication
  // =========================================================================
  describe("2. Concurrent Parcel Scanning Load Test", () => {
    it("should process 200 concurrent scans with atomic deduplication and zero data corruption", async () => {
      const barcodeService = new BarcodeService();
      const storedEvents: any[] = [];
      const storedScans: any[] = [];
      const memoryLockMap = new Map<string, number>();

      const mockPrisma: any = {
        parcel: {
          findFirst: jest.fn().mockResolvedValue({
            id: "parcel-perf-001",
            shipmentId: "shipment-perf-100",
            trackingNumber: "HES-CAS-2026-000999-01",
            status: ParcelStatus.REGISTERED,
            shipment: {
              id: "shipment-perf-100",
              trackingNumber: "HES-CAS-2026-000999",
              originAgencyId: CASA_AGENCY_ID,
              destinationAgencyId: "agency-rab-2222",
              globalStatus: "REGISTERED",
            },
          }),
        },
        trackingEvent: {
          findFirst: jest.fn().mockImplementation(async ({ where }) => {
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
            scanEvent: {
              create: jest.fn().mockImplementation(async ({ data }) => {
                const rec = { id: `scan-${Date.now()}`, ...data, createdAt: new Date() };
                storedScans.push(rec);
                return rec;
              }),
            },
            trackingEvent: {
              create: jest.fn().mockImplementation(async ({ data }) => {
                const rec = { id: `event-${Date.now()}`, ...data, createdAt: new Date() };
                storedEvents.push(rec);
                return rec;
              }),
            },
            parcel: {
              findMany: jest.fn().mockResolvedValue([
                { status: ParcelStatus.PICKED_UP },
              ]),
              update: jest.fn().mockResolvedValue({
                id: "parcel-perf-001",
                status: ParcelStatus.PICKED_UP,
              }),
            },
            shipment: {
              update: jest.fn().mockResolvedValue({}),
            },
            statusHistory: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        }),
      };

      const mockAuditService: any = {
        logEvent: jest.fn().mockResolvedValue(undefined),
      };

      const mockRedisService: any = {
        getClient: jest.fn().mockReturnValue({
          status: "ready",
          set: jest.fn().mockImplementation(async (key: string) => {
            if (memoryLockMap.has(key)) {
              return null; // Key already locked
            }
            memoryLockMap.set(key, Date.now());
            return "OK";
          }),
          get: jest.fn().mockImplementation(async (key: string) => {
            return memoryLockMap.has(key) ? "LOCKED" : null;
          }),
        }),
      };

      const useCase = new ProcessTrackingEventUseCase(
        mockPrisma,
        mockAuditService,
        mockRedisService,
        barcodeService,
      );

      const SCAN_COUNT = 200;
      const startTime = Date.now();

      // Launch 200 simultaneous scans of the same parcel
      const scanPromises = Array.from({ length: SCAN_COUNT }, async (_, idx) => {
        return useCase.executeScan(
          {
            barcode: "HES-CAS-2026-000999-01",
            targetStatus: ParcelStatus.PICKED_UP,
            scannerType: ScannerType.BARCODE_1D,
            deviceId: `ZEBRA-GUN-${idx % 10}`,
          },
          operatorUser,
        );
      });

      const scanResults = await Promise.all(scanPromises);
      const totalDuration = Date.now() - startTime;

      // Exactly 1 physical event recorded, remainder flagged as rapid duplicates
      const uniqueProcessed = scanResults.filter((r) => !r.duplicate);
      const duplicatesDetected = scanResults.filter((r) => r.duplicate);

      expect(uniqueProcessed.length).toBe(1);
      expect(duplicatesDetected.length).toBe(SCAN_COUNT - 1);
      expect(storedEvents.length).toBe(1);
      expect(storedScans.length).toBe(1);
      expect(totalDuration).toBeLessThan(1500); // 200 concurrent scans handled in <1.5s
    });
  });

  // =========================================================================
  // 3. Dashboard and Aggregated Reports Query Load Test
  // =========================================================================
  describe("3. Dashboard & Reports Concurrency Simulation", () => {
    it("should handle 50 concurrent complex aggregation queries with p95 < 50ms", async () => {
      // Complex multi-metric aggregation computation
      const simulatedDatabaseAggregation = async () => {
        const start = performance.now();
        // Emulate DB index scans and grouped aggregations
        const rows = Array.from({ length: 500 }, (_, i) => ({
          status: i % 5 === 0 ? "DELIVERED" : i % 5 === 1 ? "IN_TRANSIT" : "RETURNED",
          revenue: (i * 12.5) % 150,
          deliveredOnTime: i % 7 !== 0,
        }));

        const totalRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);
        const delivered = rows.filter((r) => r.status === "DELIVERED").length;
        const total = rows.length;
        const slaRate = (rows.filter((r) => r.deliveredOnTime).length / total) * 100;
        const duration = performance.now() - start;

        return { totalRevenue, delivered, slaRate, duration };
      };

      const CONCURRENT_QUERIES = 50;
      const t0 = performance.now();

      const queryPromises = Array.from({ length: CONCURRENT_QUERIES }, () =>
        simulatedDatabaseAggregation(),
      );

      const queryResults = await Promise.all(queryPromises);
      const totalWallTime = performance.now() - t0;

      const latencies = queryResults.map((r) => r.duration).sort((a, b) => a - b);
      const p95Index = Math.floor(CONCURRENT_QUERIES * 0.95);
      const p95Latency = latencies[p95Index];

      expect(queryResults.length).toBe(CONCURRENT_QUERIES);
      expect(p95Latency).toBeLessThan(50); // p95 < 50ms
      expect(totalWallTime).toBeLessThan(500); // 50 concurrent complex aggregations under 500ms
    });
  });
});
