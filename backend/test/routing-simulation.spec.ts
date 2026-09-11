/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  RoutingEngineService,
  RoutingAction,
} from "../src/modules/transfers/domain/routing-engine.service";

describe("Phase 6 Backend Tests: Multi-Hub Routing Simulation (Agadir → Casablanca → Rabat)", () => {
  let routingService: RoutingEngineService;
  let mockPrisma: any;

  const AGADIR_ID = "agency-agadir-uuid-1111";
  const CASA_HUB_ID = "agency-casa-uuid-2222";
  const RABAT_ID = "agency-rabat-uuid-3333";
  const TANGER_ID = "agency-tanger-uuid-4444";

  // Pre-configured multi-hub route in DB
  const mockRoute = {
    id: "route-south-north-uuid",
    code: "ROUTE-AGA-RAB",
    name: "Ligne Sud-Nord (Agadir Hub -> Rabat via Casablanca)",
    originAgencyId: AGADIR_ID,
    destinationAgencyId: RABAT_ID,
    isActive: true,
    segments: [
      {
        id: "seg-1",
        routeId: "route-south-north-uuid",
        segmentOrder: 1,
        fromAgencyId: AGADIR_ID,
        toAgencyId: CASA_HUB_ID,
        estimatedTransitHours: 8,
        distanceKm: 460,
      },
      {
        id: "seg-2",
        routeId: "route-south-north-uuid",
        segmentOrder: 2,
        fromAgencyId: CASA_HUB_ID,
        toAgencyId: RABAT_ID,
        estimatedTransitHours: 1.5,
        distanceKm: 90,
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      route: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (
            where.originAgencyId === AGADIR_ID &&
            where.destinationAgencyId === RABAT_ID &&
            where.isActive === true
          ) {
            return mockRoute;
          }
          return null;
        }),
      },
      routeSegment: {
        findMany: jest.fn().mockResolvedValue(mockRoute.segments),
      },
    };

    routingService = new RoutingEngineService(mockPrisma);
  });

  it("Step 1: At Agadir origin, engine decides HOLD_AND_RETRANSFER towards Casablanca Hub", async () => {
    const decision = await routingService.evaluateHubAction({
      originAgencyId: AGADIR_ID,
      destinationAgencyId: RABAT_ID,
      currentAgencyId: AGADIR_ID,
    });

    expect(decision.action).toBe(RoutingAction.HOLD_AND_RETRANSFER);
    expect(decision.isFinalDestination).toBe(false);
    expect(decision.nextAgencyId).toBe(CASA_HUB_ID);
    expect(decision.nextSegmentOrder).toBe(1);
    expect(decision.remainingHops).toBe(2);
    expect(decision.routeCode).toBe("ROUTE-AGA-RAB");
  });

  it("Step 2: At Casablanca intermediate Hub, engine decides HOLD_AND_RETRANSFER towards Rabat", async () => {
    const decision = await routingService.evaluateHubAction({
      originAgencyId: AGADIR_ID,
      destinationAgencyId: RABAT_ID,
      currentAgencyId: CASA_HUB_ID,
    });

    expect(decision.action).toBe(RoutingAction.HOLD_AND_RETRANSFER);
    expect(decision.isFinalDestination).toBe(false);
    expect(decision.nextAgencyId).toBe(RABAT_ID);
    expect(decision.nextSegmentOrder).toBe(2);
    expect(decision.remainingHops).toBe(1);
    expect(decision.message).toContain("Hub de transit");
  });

  it("Step 3: At Rabat final agency, engine decides UNLOAD_FOR_DELIVERY", async () => {
    const decision = await routingService.evaluateHubAction({
      originAgencyId: AGADIR_ID,
      destinationAgencyId: RABAT_ID,
      currentAgencyId: RABAT_ID,
    });

    expect(decision.action).toBe(RoutingAction.UNLOAD_FOR_DELIVERY);
    expect(decision.isFinalDestination).toBe(true);
    expect(decision.remainingHops).toBe(0);
    expect(decision.message).toContain("Déchargement");
  });

  it("Step 4: At unexpected agency (Tanger), engine detects anomaly and returns MISROUTED", async () => {
    // If parcel ends up in Tanger when route is Agadir -> Casa -> Rabat
    const decision = await routingService.evaluateHubAction({
      originAgencyId: AGADIR_ID,
      destinationAgencyId: RABAT_ID,
      currentAgencyId: TANGER_ID,
    });

    expect(decision.action).toBe(RoutingAction.MISROUTED);
    expect(decision.isFinalDestination).toBe(false);
    expect(decision.remainingHops).toBe(-1);
    expect(decision.message).toContain("hors itinéraire");
  });
});
