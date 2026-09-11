import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { ReassignParcelRunDto } from "../../dto/reassign-parcel-run.dto";
import { RunItemStatus } from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { ShipmentAssignedToCourierEvent } from "../../../../common/events/run.events";

@Injectable()
export class ReassignParcelRunUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(dto: ReassignParcelRunDto, user: AuthenticatedUser) {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException(
        "Un motif de réaffectation d'au moins 5 caractères est strictement obligatoire pour l'audit.",
      );
    }

    // 1. Fetch parcel and target run
    const [parcel, targetRun] = await Promise.all([
      this.prisma.parcel.findUnique({
        where: { id: dto.parcelId },
        include: { shipment: true },
      }),
      this.prisma.deliveryRun.findUnique({
        where: { id: dto.targetRunId },
        include: { agency: true, courier: { include: { user: true } } },
      }),
    ]);

    if (!parcel) {
      throw new NotFoundException("Colis introuvable.");
    }
    if (!targetRun) {
      throw new NotFoundException("Tournée de destination introuvable.");
    }

    // 2. Check agency permission
    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== targetRun.agencyId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez réaffecter des colis qu'au sein de votre propre agence.",
      );
    }

    // 3. Find current run item if assigned
    const currentRunItem = await this.prisma.deliveryRunItem.findFirst({
      where: { parcelId: dto.parcelId },
      include: { deliveryRun: true },
    });

    const previousRunNumber =
      (currentRunItem?.deliveryRun as any)?.runNumber ??
      (currentRunItem?.deliveryRun as any)?.number ??
      "AUCUNE_TOURNÉE";

    // 4. Perform atomic reassignment with immutable audit log
    const result = await this.prisma.$transaction(async (tx) => {
      // Remove from previous run if any
      if (currentRunItem) {
        await tx.deliveryRunItem.delete({
          where: { id: currentRunItem.id },
        });

        // Recalculate previous run metrics
        const prevItems = await tx.deliveryRunItem.findMany({
          where: { deliveryRunId: currentRunItem.deliveryRunId },
          include: { parcel: { include: { shipment: true } } },
        });
        const prevWeight = prevItems.reduce(
          (s: number, it: any) => s + Number(it.parcel?.weightKg ?? 0),
          0,
        );
        const prevCod = prevItems.reduce(
          (s: number, it: any) =>
            s +
            (it.parcel?.shipment?.codAmount
              ? Number(it.parcel.shipment.codAmount)
              : 0),
          0,
        );
        await tx.deliveryRun.update({
          where: { id: currentRunItem.deliveryRunId },
          data: {
            totalParcels: prevItems.length,
            totalWeightKg: prevWeight,
            totalCodToCollect: prevCod,
          } as any,
        });
      }

      // Add to new run
      const countInTarget = await tx.deliveryRunItem.count({
        where: { deliveryRunId: targetRun.id },
      });

      const newRunItem = await tx.deliveryRunItem.create({
        data: {
          deliveryRunId: targetRun.id,
          parcelId: dto.parcelId,
          sequenceOrder: countInTarget + 1,
          status: RunItemStatus.PENDING,
        },
      });

      // Update parcel courierId
      if (targetRun.courier?.userId) {
        await tx.parcel.update({
          where: { id: dto.parcelId },
          data: {
            courierId: targetRun.courier.userId,
          },
        });
      }

      // Recalculate target run metrics
      const targetItems = await tx.deliveryRunItem.findMany({
        where: { deliveryRunId: targetRun.id },
        include: { parcel: { include: { shipment: true } } },
      });
      const targetWeight = targetItems.reduce(
        (s: number, it: any) => s + Number(it.parcel?.weightKg ?? 0),
        0,
      );
      const targetCod = targetItems.reduce(
        (s: number, it: any) =>
          s +
          (it.parcel?.shipment?.codAmount
            ? Number(it.parcel.shipment.codAmount)
            : 0),
        0,
      );
      await tx.deliveryRun.update({
        where: { id: targetRun.id },
        data: {
          totalParcels: targetItems.length,
          totalWeightKg: targetWeight,
          totalCodToCollect: targetCod,
        } as any,
      });

      // Write immutable audit log
      let auditLog: any = null;
      if ((tx as any).runAuditLog) {
        auditLog = await (tx as any).runAuditLog.create({
          data: {
            deliveryRunId: targetRun.id,
            parcelId: dto.parcelId,
            action: dto.isOutOfZone ? "ZONE_OVERRIDE" : "MANUAL_REASSIGNMENT",
            performedById: user.id,
            previousValue: previousRunNumber,
            newValue: `${(targetRun as any).runNumber || (targetRun as any).number} (${targetRun.courier?.user?.firstName || ""} ${targetRun.courier?.user?.lastName || ""})`.trim(),
            reason: dto.reason.trim(),
          },
        });
      } else if (tx.auditLog) {
        auditLog = await tx.auditLog.create({
          data: {
            agencyId: targetRun.agencyId,
            userId: user.id,
            action: "UPDATE",
            entityType: "DeliveryRunItem",
            entityId: newRunItem.id,
            oldValues: {
              previousRunNumber,
              previousRunId: currentRunItem?.deliveryRunId,
            },
            newValues: {
              deliveryRunId: targetRun.id,
              runNumber:
                (targetRun as any).runNumber || (targetRun as any).number,
              courier:
                `${targetRun.courier?.user?.firstName || ""} ${targetRun.courier?.user?.lastName || ""}`.trim(),
              reason: dto.reason.trim(),
              isOutOfZone: dto.isOutOfZone ?? false,
            },
          },
        });
      }

      return {
        item: {
          ...newRunItem,
          isOutOfZone: dto.isOutOfZone ?? false,
        },
        targetRunId: targetRun.id,
        auditLog,
      };
    });

    // 5. Publish ShipmentAssignedToCourier event
    if (this.eventBus) {
      const courierFullName = targetRun.courier?.user
        ? `${targetRun.courier.user.firstName || ""} ${targetRun.courier.user.lastName || ""}`.trim()
        : "Livreur";

      await this.eventBus.publish(
        new ShipmentAssignedToCourierEvent({
          shipmentId:
            parcel.shipmentId || (parcel.shipment as any)?.id || parcel.id,
          parcelId: parcel.id,
          trackingNumber: parcel.trackingNumber || parcel.number || parcel.id,
          deliveryRunId: targetRun.id,
          deliveryRunNumber:
            (targetRun as any).number ||
            (targetRun as any).runNumber ||
            targetRun.id,
          courierId: targetRun.courierId || targetRun.courier?.id || "",
          courierUserId:
            targetRun.courier?.userId || targetRun.assignedToUserId || "",
          courierName: courierFullName,
          agencyId: targetRun.agencyId,
          zoneId: targetRun.zoneId,
          isOutOfZone: dto.isOutOfZone ?? false,
          assignedAt: new Date(),
          assignedByUserId: user.id,
        }),
      );
    }

    return result;
  }
}
