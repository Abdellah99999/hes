import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { ReportIncidentDto } from "../../dto/report-incident.dto";
import { IncidentStatus, IncidentSeverity, ParcelStatus } from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { IncidentCreatedEvent } from "../../../../common/events/incident.events";

@Injectable()
export class ReportIncidentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(dto: ReportIncidentDto, user: AuthenticatedUser) {
    if (!dto.description || dto.description.trim().length < 5) {
      throw new BadRequestException(
        "Une description motivée d'au moins 5 caractères est requise.",
      );
    }

    // 1. Locate shipment
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        OR: [
          { id: dto.shipmentIdentifier },
          { trackingNumber: dto.shipmentIdentifier },
        ],
      },
      include: { destinationAgency: true, originAgency: true },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Expédition introuvable : "${dto.shipmentIdentifier}".`,
      );
    }

    // 2. Locate parcel if specified
    let parcel = null;
    if (dto.parcelIdentifier) {
      parcel = await this.prisma.parcel.findFirst({
        where: {
          shipmentId: shipment.id,
          OR: [
            { id: dto.parcelIdentifier },
            { trackingNumber: dto.parcelIdentifier },
            { barcode: dto.parcelIdentifier },
          ],
        },
      });

      if (!parcel) {
        throw new NotFoundException(
          `Colis introuvable dans cette expédition : "${dto.parcelIdentifier}".`,
        );
      }
    }

    // 3. Reliable recovery of last known tracking event (Multi-tier deterministic query)
    const lastEvent = await this.prisma.trackingEvent.findFirst({
      where: parcel ? { parcelId: parcel.id } : { shipmentId: shipment.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { agency: true },
    });

    // 4. Check for delivered dispute
    const isDeliveredDispute =
      lastEvent?.status === ParcelStatus.DELIVERED ||
      parcel?.status === ParcelStatus.DELIVERED ||
      (shipment as any).globalStatus === "DELIVERED" ||
      shipment.status === "DELIVERED";

    // 5. Generate Incident Number INC-{AGENCY}-{YYYYMMDD}-{SEQ}
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const agencyCode = shipment.destinationAgency?.code || (shipment.originAgency as any)?.code || "HUB";
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const incidentNumber = `INC-${agencyCode}-${dateStr}-${randomSuffix}`;

    const agencyId =
      lastEvent?.agencyId ||
      shipment.destinationAgencyId ||
      shipment.originAgencyId ||
      user.agencyId ||
      "AGY_DEFAULT";

    const result = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          number: incidentNumber,
          shipmentId: shipment.id,
          parcelId: parcel?.id ?? null,
          agencyId,
          createdByUserId: user.id,
          type: dto.type,
          severity: dto.severity || IncidentSeverity.MEDIUM,
          status: IncidentStatus.REPORTED,
          description: dto.description.trim(),
          claimedAmount: dto.declaredValueClaimed ?? null,
        } as any,
      });

      // Initial history step
      await tx.incidentHistory.create({
        data: {
          incidentId: incident.id,
          fromStatus: null,
          toStatus: IncidentStatus.REPORTED,
          action: "OPEN_INVESTIGATION",
          notes: `Déclaration initiale d'incident (${dto.type}) par ${user.firstName} ${user.lastName} [Rôle: ${user.role}]. Dernier contexte : ${lastEvent?.status || "Inconnu"}.`,
          userId: user.id,
        } as any,
      });

      const enrichedIncident = {
        ...incident,
        incidentNumber: (incident as any).number || incidentNumber,
        lastTrackingEventId: lastEvent?.id ?? null,
        lastKnownStatus: lastEvent?.status ?? parcel?.status ?? null,
        lastKnownAgencyId: lastEvent?.agencyId ?? shipment.destinationAgencyId ?? null,
        isDeliveredDispute,
        declaredByUserId: user.id,
        declaredValueClaimed: dto.declaredValueClaimed ?? null,
      };

      return {
        incident: enrichedIncident,
        lastKnownTrackingContext: {
          eventId: lastEvent?.id ?? null,
          status: lastEvent?.status ?? null,
          agencyCode: lastEvent?.agency?.code ?? null,
        },
        isDeliveredDispute,
      };
    });

    // 6. Publish IncidentCreatedEvent via EventBus
    if (this.eventBus) {
      await this.eventBus.publish(
        new IncidentCreatedEvent({
          incidentId: result.incident.id,
          incidentNumber,
          shipmentId: shipment.id,
          parcelId: parcel?.id ?? null,
          agencyId,
          type: dto.type,
          severity: dto.severity || IncidentSeverity.MEDIUM,
          claimedAmount: dto.declaredValueClaimed ?? null,
          createdByUserId: user.id,
          isDeliveredDispute,
          lastKnownStatus: lastEvent?.status ?? parcel?.status ?? null,
          lastKnownAgencyId: lastEvent?.agencyId ?? shipment.destinationAgencyId ?? null,
          createdAt: new Date(),
        }),
      );
    }

    return result;
  }
}

