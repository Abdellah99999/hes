import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { RecoverReturnDto } from "../../dto/recover-return.dto";
import {
  ReturnStatus,
  ReturnItemStatus,
  TrackingEventSource,
  ParcelStatus,
  ReturnType,
} from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { ReturnCreatedEvent } from "../../../../common/events/return.events";

@Injectable()
export class RecoverReturnUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(dto: RecoverReturnDto, user: AuthenticatedUser) {
    const rawIdentifier = dto.identifier.trim();
    if (!rawIdentifier) {
      throw new BadRequestException("Le numéro BL ou de tracking est requis.");
    }

    // 1. Locate parcel by trackingNumber, barcode, or id
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        OR: [
          { trackingNumber: rawIdentifier },
          { barcode: rawIdentifier },
          { id: rawIdentifier },
        ],
      },
      include: {
        shipment: true,
        returnItems: {
          include: { returnDoc: true },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException(
        `Colis introuvable pour le numéro de BL ou tracking : "${rawIdentifier}".`,
      );
    }

    // 2. Check if a return item already exists for this parcel
    let returnItem: any = parcel.returnItems[0] || null;
    let newlyCreatedReturn: any = null;

    const result = await this.prisma.$transaction(async (tx) => {
      // If no return was pre-created (e.g. courier recovers direct on field without prior system return)
      if (!returnItem) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
        const returnNumber = `RET-AUTO-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newReturn = await tx.return.create({
          data: {
            number: returnNumber,
            returnNumber,
            shipmentId: parcel.shipmentId,
            parcelId: parcel.id,
            originAgencyId:
              user.agencyId || parcel.shipment.destinationAgencyId || parcel.shipment.originAgencyId,
            destinationAgencyId: parcel.shipment.originAgencyId,
            status: ReturnStatus.PICKED_UP,
            handledByUserId: user.id,
            createdByUserId: user.id,
            reason: dto.emergencyReason?.trim() || "Retour créé à la volée lors de la récupération par le livreur",
            pickedUpAt: new Date(),
          } as any,
        });

        newlyCreatedReturn = {
          ...newReturn,
          returnNumber: (newReturn as any).number || (newReturn as any).returnNumber,
        };

        const createdItem = await tx.returnItem.create({
          data: {
            returnId: newReturn.id,
            parcelId: parcel.id,
            status: ReturnItemStatus.RECOVERED,
            reason: dto.emergencyReason?.trim() || null,
            scannedAt: dto.isScan ? new Date() : null,
            processedAt: new Date(),
          } as any,
          include: { returnDoc: true },
        });

        returnItem = {
          ...createdItem,
          originalTrackingNumber: parcel.trackingNumber,
          originalBlNumber: parcel.barcode,
          recoveredViaScan: dto.isScan,
          recoveredManually: !dto.isScan,
          isFallbackEmergency: dto.isFallbackEmergency ?? false,
          emergencyReason: dto.emergencyReason?.trim() ?? null,
          recoveredAt: new Date(),
          recoveredByCourierId: user.id,
        };
      } else {
        // Update existing return item
        const updatedItem = await tx.returnItem.update({
          where: { id: returnItem.id },
          data: {
            status: ReturnItemStatus.RECOVERED,
            scannedAt: dto.isScan ? new Date() : undefined,
            processedAt: new Date(),
          } as any,
          include: { returnDoc: true },
        });

        returnItem = {
          ...updatedItem,
          originalTrackingNumber: parcel.trackingNumber,
          originalBlNumber: parcel.barcode,
          recoveredViaScan: dto.isScan,
          recoveredManually: !dto.isScan,
          isFallbackEmergency: dto.isFallbackEmergency ?? false,
          emergencyReason: dto.emergencyReason?.trim() ?? null,
          recoveredAt: new Date(),
          recoveredByCourierId: user.id,
        };

        await tx.return.update({
          where: { id: returnItem.returnId },
          data: {
            status: ReturnStatus.PICKED_UP,
            handledByUserId: user.id,
            pickedUpAt: new Date(),
          } as any,
        });
      }

      // Update parcel status to RETURNED
      await tx.parcel.update({
        where: { id: parcel.id },
        data: {
          status: ParcelStatus.RETURNED,
        },
      });

      // Record tracking event
      await tx.trackingEvent.create({
        data: {
          eventType: "RETURN_RECOVERED",
          shipmentId: parcel.shipmentId,
          parcelId: parcel.id,
          agencyId:
            parcel.currentAgencyId ||
            parcel.shipment.destinationAgencyId ||
            parcel.shipment.originAgencyId ||
            user.agencyId ||
            "AGENCY_HUB",
          userId: user.id,
          source: dto.isScan
            ? TrackingEventSource.SCAN
            : TrackingEventSource.MANUAL,
          status: ParcelStatus.RETURNED,
          previousStatus: parcel.status,
          notes: dto.isScan
            ? `Colis de retour scanné et récupéré par le coursier (${user.firstName} ${user.lastName})`
            : `Colis de retour récupéré avec saisie manuelle du BL/tracking (${user.firstName} ${user.lastName})`,
        },
      });

      return {
        returnItem,
        parcelId: parcel.id,
        trackingNumber: parcel.trackingNumber,
        recoveredVia: dto.isScan ? "SCAN" : "MANUAL",
        isEmergency: dto.isFallbackEmergency ?? false,
      };
    });

    // If a return was created on the fly, publish ReturnCreatedEvent
    if (newlyCreatedReturn && this.eventBus) {
      await this.eventBus.publish(
        new ReturnCreatedEvent({
          returnId: newlyCreatedReturn.id,
          returnNumber: newlyCreatedReturn.returnNumber,
          shipmentId: parcel.shipmentId,
          originAgencyId: newlyCreatedReturn.originAgencyId,
          destinationAgencyId: newlyCreatedReturn.destinationAgencyId,
          parcelIds: [parcel.id],
          returnType: ReturnType.REFUSAL_RETURN,
          reason: dto.emergencyReason?.trim() || "Récupération directe sur le terrain par le livreur",
          createdByUserId: user.id,
          assignedCourierId: user.id,
          createdAt: new Date(),
        }),
      );
    }

    return result;
  }
}
