import * as fs from "fs";
import * as path from "path";
import { GetTrackingTimelineUseCase } from "../src/modules/shipments/application/use-cases/get-tracking-timeline.use-case";
import { ParcelStatus } from "@prisma/client";

describe("Phase 16 Cybersecurity & Privacy Audit: GPS Non-Exposure & API Key Security", () => {
  describe("AUDIT 1: Absolute Non-Exposure of Real-Time Courier GPS to Customers", () => {
    it("should never expose real-time courier GPS coordinates or live location in tracking timeline", async () => {
      // Mock Prisma with realistic tracking event chain
      const mockPrisma: any = {
        shipment: {
          findFirst: jest.fn().mockResolvedValue({
            id: "shipment-uuid-1",
            trackingNumber: "HES-CAS-2026-000042",
            globalStatus: "OUT_FOR_DELIVERY",
            originAgency: { id: "ag-1", code: "CAS", name: "Casablanca Hub" },
            destinationAgency: { id: "ag-2", code: "RAB", name: "Rabat Agdal" },
            recipientName: "Fatima Zahra",
            destinationAddress: { city: "Rabat" },
            recipientAddress: "Avenue Allal Ben Abdellah, Rabat",
            totalParcels: 1,
            parcels: [
              {
                id: "parcel-uuid-1",
                parcelIndex: 1,
                trackingNumber: "HES-CAS-2026-000042-01",
              },
            ],
          }),
        },
        trackingEvent: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: "evt-1",
              status: ParcelStatus.REGISTERED,
              previousStatus: null,
              source: "SYSTEM",
              createdAt: new Date("2026-09-06T08:00:00Z"),
              notes: "Expédition enregistrée",
              agencyId: "ag-1",
              agency: { id: "ag-1", code: "CAS", name: "Casablanca Hub" },
              userId: "user-op-1",
              user: { id: "user-op-1", firstName: "Karim", lastName: "Agent", email: "karim@hes.ma" },
              parcelId: "parcel-uuid-1",
              parcel: { id: "parcel-uuid-1", parcelIndex: 1, trackingNumber: "HES-CAS-2026-000042-01" },
              scan: null,
            },
            {
              id: "evt-2",
              status: ParcelStatus.OUT_FOR_DELIVERY,
              previousStatus: ParcelStatus.IN_TRANSIT,
              source: "DISPATCH",
              createdAt: new Date("2026-09-06T10:30:00Z"),
              notes: "Colis chargé dans la tournée du livreur",
              agencyId: "ag-2",
              agency: { id: "ag-2", code: "RAB", name: "Rabat Agdal" },
              userId: "user-courier-1",
              user: { id: "user-courier-1", firstName: "Youssef", lastName: "Livreur", email: "youssef@hes.ma" },
              parcelId: "parcel-uuid-1",
              parcel: { id: "parcel-uuid-1", parcelIndex: 1, trackingNumber: "HES-CAS-2026-000042-01" },
              scan: null,
            },
          ]),
        },
      };

      const useCase = new GetTrackingTimelineUseCase(mockPrisma);
      const timeline = await useCase.executeByShipment("shipment-uuid-1", {
        id: "customer-1",
        email: "client@gmail.com",
        firstName: "Fatima",
        lastName: "Zahra",
        role: "CUSTOMER",
        agencyId: null,
        customerId: "cust-1",
        isActive: true,
        tokenVersion: 1,
        permissions: ["shipments:read"],
        isGlobalScope: false,
      });

      // Verification 1: Timeline top-level structure contains zero live courier telemetry
      expect(timeline).toBeDefined();
      expect(timeline.shipment).toBeDefined();
      expect((timeline as any).courierLocation).toBeUndefined();
      expect((timeline as any).currentGps).toBeUndefined();
      expect((timeline as any).livePosition).toBeUndefined();
      expect((timeline as any).latitude).toBeUndefined();
      expect((timeline as any).longitude).toBeUndefined();

      // Verification 2: Every individual event contains zero courier GPS coordinates
      expect(timeline.events.length).toBe(2);
      for (const event of timeline.events) {
        expect((event as any).latitude).toBeUndefined();
        expect((event as any).longitude).toBeUndefined();
        expect((event as any).gps).toBeUndefined();
        expect((event as any).coordinates).toBeUndefined();
        expect((event as any).speed).toBeUndefined();
        expect((event as any).heading).toBeUndefined();
      }
    });
  });

  describe("AUDIT 2: Static Code Security - No Hardcoded Google Maps API Keys", () => {
    it("should verify that no Google Maps API secret key (AIzaSy...) is committed in source code", () => {
      const googleApiKeyPattern = /AIzaSy[A-Za-z0-9_-]{33}/g;

      // Scan directories: frontend/src, backend/src, mobile
      const directoriesToAudit = [
        path.resolve(__dirname, "../src"),
        path.resolve(__dirname, "../../frontend/src"),
        path.resolve(__dirname, "../../mobile"),
      ];

      const foundViolations: string[] = [];

      function walkDirectory(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Ignore build artifacts, node_modules, logs
          if (
            entry.isDirectory() &&
            (entry.name === "node_modules" ||
              entry.name === "dist" ||
              entry.name === ".turbo" ||
              entry.name === "build")
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            walkDirectory(fullPath);
          } else if (
            entry.isFile() &&
            /\.(ts|tsx|js|jsx|json|env|md)$/.test(entry.name) &&
            !entry.name.endsWith(".log")
          ) {
            const content = fs.readFileSync(fullPath, "utf-8");
            const matches = content.match(googleApiKeyPattern);
            if (matches && matches.length > 0) {
              foundViolations.push(
                `Hardcoded Google API key pattern found in: ${fullPath} (${matches.length} occurrences)`,
              );
            }
          }
        }
      }

      for (const dir of directoriesToAudit) {
        walkDirectory(dir);
      }

      expect(foundViolations).toEqual([]);
    });

    it("should verify that .env and environment secret files are strictly listed in .gitignore", () => {
      const gitignorePath = path.resolve(__dirname, "../../.gitignore");
      expect(fs.existsSync(gitignorePath)).toBe(true);

      const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
      expect(gitignoreContent).toMatch(/^\.env$/m);
      expect(gitignoreContent).toMatch(/^\.env\.local$/m);
    });
  });
});
