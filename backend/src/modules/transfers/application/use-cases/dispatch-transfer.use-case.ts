import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { DispatchTransferDto } from "../../dto/dispatch-transfer.dto";
import {
  TransferStatus,
  TransferItemStatus,
  ParcelStatus,
  TrackingEventSource,
} from "@prisma/client";
import { computeGlobalShipmentStatus } from "../../../shipments/domain/shipment-status.calculator";

@Injectable()
export class DispatchTransferUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    transferId: string,
    dto: DispatchTransferDto,
    user: AuthenticatedUser,
  ) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        items: {
          include: { parcel: true },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException("Transfert introuvable.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== transfer.originAgencyId
    ) {
      throw new ForbiddenException(
        "Seul un opérateur de l'agence d'origine peut valider le départ du camion.",
      );
    }

    if (transfer.status !== TransferStatus.PREPARED) {
      throw new BadRequestException(
        `Impossible d'expédier un transfert au statut '${transfer.status}' (statut requis : PREPARED).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const noteAdditions: string[] = [];
      if (dto.sealNumber?.trim()) {
        noteAdditions.push(`[Plomb: ${dto.sealNumber.trim()}]`);
      }
      if (dto.notes?.trim()) {
        noteAdditions.push(dto.notes.trim());
      }
      const updatedNotes =
        noteAdditions.length > 0
          ? `${transfer.notes || ""}\n[Départ] ${noteAdditions.join(" ")}`.trim()
          : transfer.notes;

      // 1. Update transfer status
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.IN_TRANSIT,
          dispatchedAt: now,
          vehiclePlate: dto.vehiclePlate?.trim() || transfer.vehiclePlate,
          driverName: dto.driverName?.trim() || transfer.driverName,
          driverPhone: dto.driverPhone?.trim() || transfer.driverPhone,
          notes: updatedNotes,
        },
      });

      // 2. Update parcels & record tracking events
      const affectedShipmentIds = new Set<string>();

      for (const item of transfer.items) {
        const parcel = item.parcel;
        affectedShipmentIds.add(parcel.shipmentId);

        // Update item status to DISPATCHED
        await tx.transferItem.update({
          where: { id: item.id },
          data: {
            status: TransferItemStatus.DISPATCHED,
          },
        });

        // Option A (ADR 0002): currentAgencyId becomes NULL during transit
        await tx.parcel.update({
          where: { id: parcel.id },
          data: {
            status: ParcelStatus.IN_TRANSIT,
            currentAgencyId: null,
            currentTransferId: transfer.id,
          },
        });

        await tx.trackingEvent.create({
          data: {
            shipmentId: parcel.shipmentId,
            parcelId: parcel.id,
            agencyId: transfer.originAgencyId,
            userId: user.id,
            eventType: "TRANSFER_DISPATCHED",
            source: TrackingEventSource.SYSTEM,
            status: ParcelStatus.IN_TRANSIT,
            previousStatus: parcel.status,
            notes: `Départ en transfert ${transfer.transferNumber || transfer.number} vers agence ${transfer.destinationAgencyId}`,
          },
        });
      }

      // 3. Recalculate global statuses of parent shipments
      for (const shipmentId of affectedShipmentIds) {
        const siblingParcels = await tx.parcel.findMany({
          where: { shipmentId, deletedAt: null },
          select: { status: true },
        });

        const newGlobalStatus = computeGlobalShipmentStatus(
          siblingParcels.map((p) => p.status),
        );

        await tx.shipment.update({
          where: { id: shipmentId },
          data: { globalStatus: newGlobalStatus },
        });
      }

      return updatedTransfer;
    });
  }
}
