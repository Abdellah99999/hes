import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { RegisterDeferredPodDto } from "../../dto/register-deferred-pod.dto";
import { computeGlobalShipmentStatus } from "../../../shipments/domain/shipment-status.calculator";
import {
  ParcelStatus,
  ProofType,
  AttemptType,
  AttemptResult,
  TrackingEventSource,
} from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { DeliveryCompletedEvent } from "../../../../common/events/delivery.events";

@Injectable()
export class RegisterDeferredPodUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(
    parcelId: string,
    dto: RegisterDeferredPodDto,
    user: AuthenticatedUser,
  ) {
    if (!dto.podPhotoStorageKey || !dto.recipientName) {
      throw new BadRequestException(
        "La photo du BL papier cacheté et le nom du réceptionnaire sont requis.",
      );
    }

    const parcel = await this.prisma.parcel.findFirst({
      where: {
        OR: [{ id: parcelId }, { trackingNumber: parcelId }],
      },
      include: {
        shipment: {
          include: { parcels: true },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException("Colis introuvable.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create DeliveryAttempt (SUCCESS)
      const attempt = await tx.deliveryAttempt.create({
        data: {
          parcelId: parcel.id,
          courierId: user.id,
          attemptType: AttemptType.DELIVERY,
          result: AttemptResult.SUCCESS,
          courierNotes:
            `Enregistrement différé BL papier par agent: ${dto.agentNotes || ""}`.trim(),
        },
      });

      // 2. Create DeliveryProof
      const proof = await tx.deliveryProof.create({
        data: {
          deliveryAttemptId: attempt.id,
          parcelId: parcel.id,
          proofType: ProofType.PAPER_POD_PHOTO,
          podMethod: "DEFERRED_SCAN",
          signerName: dto.recipientName.trim(),
          signerCin: dto.recipientCin?.trim() ?? null,
          podPhotoStorageKey: dto.podPhotoStorageKey.trim(),
          registeredByUserId: user.id,
        },
      });

      // 3. Update Parcel status to DELIVERED
      const updatedParcel = await tx.parcel.update({
        where: { id: parcel.id },
        data: {
          status: ParcelStatus.DELIVERED,
        },
      });

      const agencyId =
        parcel.currentAgencyId ||
        parcel.shipment.destinationAgencyId ||
        parcel.originAgencyId ||
        user.agencyId ||
        "";

      // 4. Record TrackingEvent
      await tx.trackingEvent.create({
        data: {
          eventType: "DEFERRED_POD_REGISTERED",
          shipmentId: parcel.shipmentId,
          parcelId: parcel.id,
          agencyId,
          userId: user.id,
          source: TrackingEventSource.MANUAL,
          status: ParcelStatus.DELIVERED,
          previousStatus: parcel.status,
          notes: `BL papier cacheté numérisé en différé par l'agent quai (${user.firstName} ${user.lastName})`,
        },
      });

      // 5. Recalculate global shipment status
      const siblingParcels = parcel.shipment.parcels.map((p) =>
        p.id === parcel.id ? ParcelStatus.DELIVERED : p.status,
      );
      const newGlobalStatus = computeGlobalShipmentStatus(siblingParcels);

      await tx.shipment.update({
        where: { id: parcel.shipmentId },
        data: { globalStatus: newGlobalStatus },
      });

      return {
        parcel: updatedParcel,
        attempt,
        proof: {
          ...proof,
          isDeferredScan: true,
          recipientName: dto.recipientName.trim(),
          recipientCin: dto.recipientCin?.trim() ?? null,
        },
        globalShipmentStatus: newGlobalStatus,
      };
    });

    // 6. Publish DeliveryCompleted event via EventBus
    if (this.eventBus) {
      await this.eventBus.publish(
        new DeliveryCompletedEvent({
          deliveryAttemptId: result.attempt.id,
          parcelId: parcel.id,
          shipmentId: parcel.shipmentId,
          trackingNumber:
            parcel.trackingNumber || (parcel as any).number || parcel.id,
          courierId: "",
          courierUserId: user.id,
          agencyId:
            parcel.currentAgencyId ||
            parcel.shipment.destinationAgencyId ||
            parcel.originAgencyId ||
            user.agencyId ||
            "",
          recipientName: dto.recipientName.trim(),
          recipientCin: dto.recipientCin?.trim() ?? null,
          proofType: ProofType.PAPER_POD_PHOTO,
          podMethod: "DEFERRED_SCAN",
          collectedCodAmount: null,
          isDeferredScan: true,
          registeredByUserId: user.id,
          deliveredAt: new Date(),
          globalShipmentStatus: result.globalShipmentStatus,
        }),
      );
    }

    return result;
  }
}
