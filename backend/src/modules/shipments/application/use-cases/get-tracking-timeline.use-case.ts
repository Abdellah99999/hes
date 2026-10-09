import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

export interface TimelineEventItem {
  id: string;
  source: string;
  status: string;
  previousStatus: string | null;
  createdAt: Date;
  notes: string | null;
  agency: {
    id: string;
    code: string;
    name: string;
  };
  operator: {
    id: string;
    name: string;
    email: string;
  } | null;
  parcel: {
    id: string;
    parcelIndex: number;
    trackingNumber: string;
  } | null;
  scan?: {
    id: string;
    rawCode?: string;
    rawBarcode?: string;
    scanType?: string;
    scannerType?: string;
  } | null;
}

export interface ReconstructedTimeline {
  shipment: {
    id: string;
    trackingNumber: string;
    globalStatus: string;
    originAgency: { id: string; code: string; name: string };
    destinationAgency: { id: string; code: string; name: string };
    recipientName: string;
    recipientCity: string;
    totalParcels: number;
  };
  filterParcelId?: string | null;
  eventsCount: number;
  events: TimelineEventItem[];
}

@Injectable()
export class GetTrackingTimelineUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async executeByShipment(
    shipmentIdOrTracking: string,
    user: AuthenticatedUser,
  ): Promise<ReconstructedTimeline> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        OR: [
          { id: shipmentIdOrTracking },
          { trackingNumber: shipmentIdOrTracking },
        ],
        deletedAt: null,
      },
      include: {
        originAgency: true,
        destinationAgency: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException("Expédition introuvable pour la timeline.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      shipment.originAgencyId !== user.agencyId &&
      shipment.destinationAgencyId !== user.agencyId
    ) {
      throw new ForbiddenException(
        "Accès refusé : l'historique demandé n'appartient pas à votre périmètre d'agence.",
      );
    }

    const rawEvents = await this.prisma.trackingEvent.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { createdAt: "asc" },
      include: {
        agency: { select: { id: true, code: true, name: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        parcel: {
          select: { id: true, parcelIndex: true, trackingNumber: true },
        },
        scan: { select: { id: true, rawCode: true, scanType: true } },
      },
    });

    return {
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber || shipment.number || "",
        globalStatus: shipment.globalStatus || shipment.status || "",
        originAgency: shipment.originAgency,
        destinationAgency: shipment.destinationAgency || {
          id: "",
          code: "N/A",
          name: "Non assignée",
        },
        recipientName: shipment.recipientName,
        recipientCity:
          (
            shipment as unknown as {
              destinationAddress?: { city?: string };
              recipientCity?: string;
              recipientAddress?: string;
            }
          ).destinationAddress?.city ||
          (shipment as unknown as { recipientCity?: string }).recipientCity ||
          (
            shipment as unknown as { recipientAddress?: string }
          ).recipientAddress
            ?.split(",")
            ?.pop()
            ?.trim() ||
          "N/A",
        totalParcels: shipment.totalParcels,
      },
      eventsCount: rawEvents.length,
      events: rawEvents.map((e) => ({
        id: e.id,
        source: e.source,
        status: e.status,
        previousStatus: e.previousStatus,
        createdAt: e.createdAt,
        notes: e.notes,
        agency: e.agency,
        operator: e.user
          ? {
              id: e.user.id,
              name: `${e.user.firstName} ${e.user.lastName}`.trim(),
              email: e.user.email,
            }
          : null,
        parcel: e.parcel
          ? {
              id: e.parcel.id,
              parcelIndex: e.parcel.parcelIndex,
              trackingNumber: e.parcel.trackingNumber ?? "",
            }
          : null,
        scan: e.scan
          ? {
              id: e.scan.id,
              rawCode:
                e.scan.rawCode ||
                (e.scan as unknown as { rawBarcode?: string }).rawBarcode ||
                "",
              rawBarcode:
                e.scan.rawCode ||
                (e.scan as unknown as { rawBarcode?: string }).rawBarcode ||
                "",
              scanType:
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scanType ||
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scannerType ||
                "BARCODE",
              scannerType:
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scannerType ||
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scanType ||
                "BARCODE",
            }
          : null,
      })),
    };
  }

  async executeByParcel(
    parcelIdOrTracking: string,
    user: AuthenticatedUser,
  ): Promise<ReconstructedTimeline> {
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        OR: [
          { id: parcelIdOrTracking },
          { trackingNumber: parcelIdOrTracking },
        ],
        deletedAt: null,
      },
      include: {
        shipment: {
          include: {
            originAgency: true,
            destinationAgency: true,
          },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException("Colis introuvable pour la timeline.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      parcel.shipment.originAgencyId !== user.agencyId &&
      parcel.shipment.destinationAgencyId !== user.agencyId
    ) {
      throw new ForbiddenException(
        "Accès refusé : l'historique demandé n'appartient pas à votre périmètre d'agence.",
      );
    }

    const rawEvents = await this.prisma.trackingEvent.findMany({
      where: { parcelId: parcel.id },
      orderBy: { createdAt: "asc" },
      include: {
        agency: { select: { id: true, code: true, name: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        parcel: {
          select: { id: true, parcelIndex: true, trackingNumber: true },
        },
        scan: { select: { id: true, rawCode: true, scanType: true } },
      },
    });

    return {
      shipment: {
        id: parcel.shipment.id,
        trackingNumber:
          parcel.shipment.trackingNumber || parcel.shipment.number || "",
        globalStatus:
          parcel.shipment.globalStatus || parcel.shipment.status || "",
        originAgency: parcel.shipment.originAgency,
        destinationAgency: parcel.shipment.destinationAgency || {
          id: "",
          code: "N/A",
          name: "Non assignée",
        },
        recipientName: parcel.shipment.recipientName,
        recipientCity:
          (
            parcel.shipment as unknown as {
              destinationAddress?: { city?: string };
              recipientCity?: string;
              recipientAddress?: string;
            }
          ).destinationAddress?.city ||
          (parcel.shipment as unknown as { recipientCity?: string })
            .recipientCity ||
          (
            parcel.shipment as unknown as { recipientAddress?: string }
          ).recipientAddress
            ?.split(",")
            ?.pop()
            ?.trim() ||
          "N/A",
        totalParcels: parcel.shipment.totalParcels,
      },
      filterParcelId: parcel.id,
      eventsCount: rawEvents.length,
      events: rawEvents.map((e) => ({
        id: e.id,
        source: e.source,
        status: e.status,
        previousStatus: e.previousStatus,
        createdAt: e.createdAt,
        notes: e.notes,
        agency: e.agency,
        operator: e.user
          ? {
              id: e.user.id,
              name: `${e.user.firstName} ${e.user.lastName}`.trim(),
              email: e.user.email,
            }
          : null,
        parcel: e.parcel
          ? {
              id: e.parcel.id,
              parcelIndex: e.parcel.parcelIndex,
              trackingNumber: e.parcel.trackingNumber ?? "",
            }
          : null,
        scan: e.scan
          ? {
              id: e.scan.id,
              rawCode:
                e.scan.rawCode ||
                (e.scan as unknown as { rawBarcode?: string }).rawBarcode ||
                "",
              rawBarcode:
                e.scan.rawCode ||
                (e.scan as unknown as { rawBarcode?: string }).rawBarcode ||
                "",
              scanType:
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scanType ||
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scannerType ||
                "BARCODE",
              scannerType:
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scannerType ||
                (
                  e.scan as unknown as {
                    scanType?: string;
                    scannerType?: string;
                  }
                ).scanType ||
                "BARCODE",
            }
          : null,
      })),
    };
  }
}
