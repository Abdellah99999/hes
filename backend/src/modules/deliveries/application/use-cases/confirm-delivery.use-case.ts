import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { ConfirmDeliveryDto } from "../../dto/confirm-delivery.dto";
import { computeGlobalShipmentStatus } from "../../../shipments/domain/shipment-status.calculator";
import {
  ParcelStatus,
  AttemptType,
  AttemptResult,
  RunItemStatus,
  TrackingEventSource,
} from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { DeliveryCompletedEvent } from "../../../../common/events/delivery.events";

@Injectable()
export class ConfirmDeliveryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(
    parcelId: string,
    dto: ConfirmDeliveryDto,
    user: AuthenticatedUser,
  ) {
    // 1. Mandatory POD validation
    if (!dto.recipientName || dto.recipientName.trim().length === 0) {
      throw new BadRequestException(
        "Impossible de confirmer une livraison sans nom de réceptionnaire.",
      );
    }

    if (dto.proofType === "DIGITAL_SIGNATURE" && !dto.signatureDataUrl) {
      throw new BadRequestException(
        "Une signature tactile est obligatoire pour le type de preuve DIGITAL_SIGNATURE.",
      );
    }

    if (dto.proofType === "PAPER_POD_PHOTO" && !dto.podPhotoStorageKey) {
      throw new BadRequestException(
        "La photo du BL papier cacheté est obligatoire pour le type de preuve PAPER_POD_PHOTO.",
      );
    }

    // 2. Fetch parcel and run item
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
      include: {
        shipment: {
          include: { parcels: true },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException("Colis introuvable.");
    }

    const runItem = await this.prisma.deliveryRunItem.findFirst({
      where: { parcelId },
      include: {
        deliveryRun: {
          include: { courier: true },
        },
      },
    });

    // 3. Courier permission check
    if (user.role === "COURIER") {
      if (runItem && runItem.deliveryRun.courier?.userId !== user.id) {
        throw new ForbiddenException(
          "Vous ne pouvez confirmer que les livraisons de votre propre tournée.",
        );
      }
    }

    // 4. Transactional confirmation
    const result = await this.prisma.$transaction(async (tx) => {
      // 4.1 Create DeliveryAttempt (SUCCESS)
      const attempt = await tx.deliveryAttempt.create({
        data: {
          parcelId,
          deliveryRunId: runItem?.deliveryRunId ?? null,
          courierId: user.id,
          attemptType: AttemptType.DELIVERY,
          result: AttemptResult.SUCCESS,
          collectedCodAmount: dto.collectedCodAmount ?? null,
          courierNotes: dto.courierNotes?.trim() ?? null,
        },
      });

      // 4.2 Create DeliveryProof
      const proof = await tx.deliveryProof.create({
        data: {
          deliveryAttemptId: attempt.id,
          parcelId,
          proofType: dto.proofType,
          podMethod: "DIRECT_APP",
          signerName: dto.recipientName.trim(),
          signerCin: dto.recipientCin?.trim() ?? null,
          signatureDataUrl: dto.signatureDataUrl ?? null,
          podPhotoStorageKey: dto.podPhotoStorageKey ?? null,
          registeredByUserId: user.id,
        },
      });

      // 4.3 Update Parcel status to DELIVERED
      const updatedParcel = await tx.parcel.update({
        where: { id: parcelId },
        data: {
          status: ParcelStatus.DELIVERED,
        },
      });

      // 4.4 Update DeliveryRunItem if exists
      if (runItem) {
        await tx.deliveryRunItem.update({
          where: { id: runItem.id },
          data: {
            status: RunItemStatus.COMPLETED,
            deliveredAt: new Date(),
            recipientSignature: dto.signatureDataUrl ?? dto.recipientName,
            collectedCod: dto.collectedCodAmount ?? null,
          },
        });

        if (dto.collectedCodAmount && Number(dto.collectedCodAmount) > 0) {
          await tx.deliveryRun.update({
            where: { id: runItem.deliveryRunId },
            data: {
              collectedCodAmount: { increment: dto.collectedCodAmount },
            },
          });
        }
      }

      const agencyId =
        parcel.currentAgencyId ||
        parcel.shipment.destinationAgencyId ||
        parcel.originAgencyId ||
        user.agencyId ||
        "";

      // 4.5 Record TrackingEvent
      await tx.trackingEvent.create({
        data: {
          eventType: "DELIVERY_CONFIRMED",
          shipmentId: parcel.shipmentId,
          parcelId,
          agencyId,
          userId: user.id,
          source: TrackingEventSource.SCAN,
          status: ParcelStatus.DELIVERED,
          previousStatus: parcel.status,
          notes: `Colis remis en main propre à ${dto.recipientName}. Preuve POD: ${dto.proofType}`,
        },
      });

      // 4.6 Recalculate global shipment status
      const siblingParcels = parcel.shipment.parcels.map((p) =>
        p.id === parcelId ? ParcelStatus.DELIVERED : p.status,
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
          recipientName: dto.recipientName.trim(),
          recipientCin: dto.recipientCin?.trim() ?? null,
        },
        globalShipmentStatus: newGlobalStatus,
      };
    });

    // 5. Publish DeliveryCompleted event via EventBus
    if (this.eventBus) {
      await this.eventBus.publish(
        new DeliveryCompletedEvent({
          deliveryAttemptId: result.attempt.id,
          parcelId,
          shipmentId: parcel.shipmentId,
          trackingNumber:
            parcel.trackingNumber || (parcel as any).number || parcel.id,
          courierId: runItem?.deliveryRun?.courierId || "",
          courierUserId: user.id,
          agencyId:
            parcel.currentAgencyId ||
            parcel.shipment.destinationAgencyId ||
            parcel.originAgencyId ||
            user.agencyId ||
            "",
          recipientName: dto.recipientName.trim(),
          recipientCin: dto.recipientCin?.trim() ?? null,
          proofType: dto.proofType,
          podMethod: "DIRECT_APP",
          collectedCodAmount: dto.collectedCodAmount
            ? Number(dto.collectedCodAmount)
            : null,
          isDeferredScan: false,
          registeredByUserId: user.id,
          deliveredAt: new Date(),
          globalShipmentStatus: result.globalShipmentStatus,
        }),
      );
    }

    return result;
  }
}
