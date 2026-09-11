import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

export enum RoutingAction {
  UNLOAD_FOR_DELIVERY = "UNLOAD_FOR_DELIVERY",
  HOLD_AND_RETRANSFER = "HOLD_AND_RETRANSFER",
  MISROUTED = "MISROUTED",
}

export interface RoutingDecision {
  action: RoutingAction;
  message: string;
  isFinalDestination: boolean;
  currentAgencyId: string;
  destinationAgencyId: string;
  nextAgencyId?: string;
  nextSegmentOrder?: number;
  routeId?: string;
  routeCode?: string;
  remainingHops: number;
}

export interface RoutePathStep {
  segmentOrder: number;
  fromAgencyId: string;
  toAgencyId: string;
  estimatedTransitHours?: number | null;
  distanceKm?: number | null;
}

@Injectable()
export class RoutingEngineService {
  private readonly logger = new Logger(RoutingEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates the routing decision for a parcel present at `currentAgencyId`
   * whose final destination is `destinationAgencyId`.
   * Completely generic and database-driven: zero hardcoded agency codes or rules.
   */
  async evaluateHubAction(params: {
    originAgencyId: string;
    destinationAgencyId: string;
    currentAgencyId: string;
  }): Promise<RoutingDecision> {
    const { originAgencyId, destinationAgencyId, currentAgencyId } = params;

    // 1. Terminal condition: Parcel has arrived at its final agency
    if (currentAgencyId === destinationAgencyId) {
      return {
        action: RoutingAction.UNLOAD_FOR_DELIVERY,
        message:
          "Arrivé à destination finale : Déchargement pour tri et distribution locale.",
        isFinalDestination: true,
        currentAgencyId,
        destinationAgencyId,
        remainingHops: 0,
      };
    }

    // 2. Lookup active route from origin to destination
    const route = await this.prisma.route.findFirst({
      where: {
        originAgencyId,
        destinationAgencyId,
        isActive: true,
      },
      include: {
        segments: {
          orderBy: { segmentOrder: "asc" },
        },
      },
    });

    if (route && route.segments.length > 0) {
      return this.evaluateAgainstSegments(
        route.segments,
        currentAgencyId,
        destinationAgencyId,
        route.id,
        route.code,
      );
    }

    // 3. Fallback: Dynamic shortest path search across all active route segments (BFS graph search)
    const dynamicPath = await this.findDynamicPath(
      currentAgencyId,
      destinationAgencyId,
    );
    if (dynamicPath && dynamicPath.length > 0) {
      const nextStep = dynamicPath[0];
      return {
        action: RoutingAction.HOLD_AND_RETRANSFER,
        message: `Hub intermédiaire : Conserver sur quai et transférer vers l'agence suivante (${nextStep.toAgencyId}).`,
        isFinalDestination: false,
        currentAgencyId,
        destinationAgencyId,
        nextAgencyId: nextStep.toAgencyId,
        nextSegmentOrder: nextStep.segmentOrder,
        remainingHops: dynamicPath.length,
      };
    }

    // 4. Misrouted alert
    return {
      action: RoutingAction.MISROUTED,
      message: `Alerte Aiguillage : Aucun itinéraire logistique configuré entre l'agence actuelle (${currentAgencyId}) et la destination (${destinationAgencyId}).`,
      isFinalDestination: false,
      currentAgencyId,
      destinationAgencyId,
      remainingHops: -1,
    };
  }

  /**
   * Helper evaluating a predefined ordered segment list.
   */
  private evaluateAgainstSegments(
    segments: Array<{
      id: string;
      segmentOrder: number;
      fromAgencyId: string;
      toAgencyId: string;
    }>,
    currentAgencyId: string,
    destinationAgencyId: string,
    routeId: string,
    routeCode: string,
  ): RoutingDecision {
    // Find if currentAgencyId matches any "fromAgencyId" in the path
    const matchingSegmentIndex = segments.findIndex(
      (s) => s.fromAgencyId === currentAgencyId,
    );

    if (matchingSegmentIndex !== -1) {
      const currentSegment = segments[matchingSegmentIndex];
      const remainingHops = segments.length - matchingSegmentIndex;

      return {
        action: RoutingAction.HOLD_AND_RETRANSFER,
        message: `Hub de transit (Route ${routeCode}) : Charger sur transfert vers l'agence ${currentSegment.toAgencyId}.`,
        isFinalDestination: false,
        currentAgencyId,
        destinationAgencyId,
        nextAgencyId: currentSegment.toAgencyId,
        nextSegmentOrder: currentSegment.segmentOrder,
        routeId,
        routeCode,
        remainingHops,
      };
    }

    // If current agency is the target of the final segment
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.toAgencyId === currentAgencyId) {
      return {
        action: RoutingAction.UNLOAD_FOR_DELIVERY,
        message: "Arrivé à destination finale selon la route : Déchargement.",
        isFinalDestination: true,
        currentAgencyId,
        destinationAgencyId,
        routeId,
        routeCode,
        remainingHops: 0,
      };
    }

    // Not on route
    return {
      action: RoutingAction.MISROUTED,
      message: `Colis hors itinéraire (Route ${routeCode}) : L'agence ${currentAgencyId} ne fait pas partie du plan de transport prévu.`,
      isFinalDestination: false,
      currentAgencyId,
      destinationAgencyId,
      routeId,
      routeCode,
      remainingHops: -1,
    };
  }

  /**
   * Generic Breadth-First-Search (BFS) across all active segments to find shortest hop path.
   */
  async findDynamicPath(
    fromAgencyId: string,
    toAgencyId: string,
  ): Promise<RoutePathStep[] | null> {
    const allSegments = await this.prisma.routeSegment.findMany({
      where: {
        route: { isActive: true },
      },
      select: {
        id: true,
        routeId: true,
        segmentOrder: true,
        fromAgencyId: true,
        toAgencyId: true,
        estimatedTransitHours: true,
        distanceKm: true,
      },
    });

    const queue: Array<{ current: string; path: RoutePathStep[] }> = [
      { current: fromAgencyId, path: [] },
    ];
    const visited = new Set<string>([fromAgencyId]);

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;

      if (current === toAgencyId) {
        return path;
      }

      const outgoing = allSegments.filter((s) => s.fromAgencyId === current);
      for (const seg of outgoing) {
        if (!visited.has(seg.toAgencyId)) {
          visited.add(seg.toAgencyId);
          queue.push({
            current: seg.toAgencyId,
            path: [
              ...path,
              {
                segmentOrder: path.length + 1,
                fromAgencyId: seg.fromAgencyId,
                toAgencyId: seg.toAgencyId,
                estimatedTransitHours: seg.estimatedTransitHours
                  ? Number(seg.estimatedTransitHours)
                  : null,
                distanceKm: seg.distanceKm ? Number(seg.distanceKm) : null,
              },
            ],
          });
        }
      }
    }

    return null;
  }
}
