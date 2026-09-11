import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { RecordRefusalDto } from "../../dto/record-refusal.dto";
import { computeGlobalShipmentStatus } from "../../../shipments/domain/shipment-status.calculator";
import {
  ParcelStatus,
  AttemptType,
  AttemptResult,
  RunItemStatus,
  TrackingEventSource,
} from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { DeliveryFailedEvent } from "../../../../common/events/delivery.events";

@Injectable()
export class RecordRefusalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(
    parcelId: string,
    dto: RecordRefusalDto,
    user: AuthenticatedUser,
  ) {
    // 1. Fetch parcel, shipment siblings and run item
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

    // 2. Courier permission check
    if (user.role === "COURIER") {
      if (runItem && runItem.deliveryRun.courier?.userId !== user.id) {
        throw new ForbiddenException(
          "Vous ne pouvez enregistrer de refus que pour votre propre tournée.",
        );
      }
    }

    // 3. Find or ensure RefusalReason exists in repository
    let refusalReason = await this.prisma.refusalReason.findUnique({
      where: { code: dto.reasonCode },
    });

    if (!refusalReason) {
      refusalReason = await this.prisma.refusalReason.create({
        data: {
          code: dto.reasonCode,
          labelFr: dto.reasonCode,
        },
      });
    }

    // 4. Transactional refusal and return triggering
    const result = await this.prisma.$transaction(async (tx) => {
      // 4.1 Record DeliveryAttempt (REFUSED)
      const attempt = await tx.deliveryAttempt.create({
        data: {
          parcelId,
          deliveryRunId: runItem?.deliveryRunId ?? null,
          courierId: user.id,
          attemptType: AttemptType.DELIVERY,
          result: AttemptResult.REFUSED,
          refusalReasonId: refusalReason.id,
          courierNotes: dto.courierNotes?.trim() ?? null,
        },
      });

      // 4.2 Transition parcel status immediately to RETURNED (déclenche retour)
      const updatedParcel = await tx.parcel.update({
        where: { id: parcelId },
        data: {
          status: ParcelStatus.RETURNED,
          notes:
            `Refusé par destinataire : [${dto.reasonCode}]. ${dto.courierNotes || ""}`.trim(),
        },
      });

      // 4.3 Update DeliveryRunItem
      if (runItem) {
        await tx.deliveryRunItem.update({
          where: { id: runItem.id },
          data: {
            status: RunItemStatus.FAILED,
          },
        });
      }

      const agencyId =
        parcel.currentAgencyId ||
        parcel.shipment.destinationAgencyId ||
        parcel.originAgencyId ||
        user.agencyId ||
        "";

      // 4.4 Record TrackingEvent (RETURNED)
      await tx.trackingEvent.create({
        data: {
          eventType: "DELIVERY_REFUSED",
          shipmentId: parcel.shipmentId,
          parcelId,
          agencyId,
          userId: user.id,
          source: TrackingEventSource.SCAN,
          status: ParcelStatus.RETURNED,
          previousStatus: parcel.status,
          notes: `Colis refusé par le destinataire (${dto.reasonCode}) - Retour automatique déclenché`,
        },
      });

      // 4.5 Recalculate global shipment status
      const siblingParcels = parcel.shipment.parcels.map((p) =>
        p.id === parcelId ? ParcelStatus.RETURNED : p.status,
      );
      const newGlobalStatus = computeGlobalShipmentStatus(siblingParcels);

      await tx.shipment.update({
        where: { id: parcel.shipmentId },
        data: { globalStatus: newGlobalStatus },
      });

      return {
        parcel: updatedParcel,
        attempt,
        refusalReason: refusalReason.code,
        globalShipmentStatus: newGlobalStatus,
      };
    });

    // 5. Publish DeliveryFailed event via EventBus (triggersReturn: true)
    if (this.eventBus) {
      await this.eventBus.publish(
        new DeliveryFailedEvent({
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
          attemptResult: AttemptResult.REFUSED,
          refusalReasonCode: refusalReason.code as any,
          isRefusal: true,
          triggersReturn: true,
          courierNotes: dto.courierNotes?.trim() ?? null,
          attemptedAt: new Date(),
          globalShipmentStatus: result.globalShipmentStatus,
        }),
      );
    }

    return result;
  }
}
