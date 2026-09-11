import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuditService } from "../../../auth/services/audit.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { ReceiveTransferDto } from "../../dto/receive-transfer.dto";
import {
  TransferStatus,
  TransferItemStatus,
  ParcelStatus,
  TrackingEventSource,
  AuditEventType,
} from "@prisma/client";
import { computeGlobalShipmentStatus } from "../../../shipments/domain/shipment-status.calculator";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { TransferReceivedEvent } from "../../../../common/events/transfer.events";

export interface ReceiveTransferResult {
  transfer: {
    id: string;
    status: TransferStatus;
    totalReceivedParcels: number;
    totalMissingParcels: number;
    [key: string]: unknown;
  };
  receivedCount: number;
  missingCount: number;
  hasDiscrepancy: boolean;
  missingParcels: Array<{
    parcelId: string;
    trackingNumber: string;
    notes?: string;
  }>;
}

@Injectable()
export class ReceiveTransferUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(
    transferId: string,
    dto: ReceiveTransferDto,
    user: AuthenticatedUser,
  ): Promise<ReceiveTransferResult> {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        originAgency: true,
        destinationAgency: true,
        items: {
          include: { parcel: true },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException("Transfert introuvable.");
    }

    // 1. Security check: Only operators of destination agency can receive
    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== transfer.destinationAgencyId
    ) {
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action: "RECEIVE_TRANSFER_UNAUTHORIZED_AGENCY",
          transferId,
          transferDestination: transfer.destinationAgencyId,
          userAgency: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Vous ne pouvez réceptionner ce transfert que si vous appartenez à l'agence de destination.",
      );
    }

    // 2. State check: Must be in transit
    if (transfer.status !== TransferStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Impossible de réceptionner un transfert au statut '${transfer.status}' (statut requis : IN_TRANSIT).`,
      );
    }

    // 3. Normalized matching identifiers (accepting UUIDs or tracking numbers)
    const receivedIdentifiers = new Set(
      dto.receivedParcelIds.map((id) => id.trim().toUpperCase()),
    );

    let receivedCount = 0;
    let missingCount = 0;
    const missingParcels: Array<{
      parcelId: string;
      trackingNumber: string;
      notes?: string;
    }> = [];

    const updatedTransfer = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const affectedShipmentIds = new Set<string>();

      // 4. Reconcile expected items
      for (const item of transfer.items) {
        const parcel = item.parcel;
        affectedShipmentIds.add(parcel.shipmentId);

        const isReceived =
          receivedIdentifiers.has(parcel.id.toUpperCase()) ||
          (parcel.trackingNumber &&
            receivedIdentifiers.has(parcel.trackingNumber.toUpperCase())) ||
          (parcel.barcode &&
            receivedIdentifiers.has(parcel.barcode.toUpperCase()));

        if (isReceived) {
          // Parcel received and present on destination dock
          receivedCount++;

          await tx.transferItem.update({
            where: { id: item.id },
            data: {
              status: TransferItemStatus.RECEIVED,
              receivedAt: now,
            },
          });

          await tx.parcel.update({
            where: { id: parcel.id },
            data: {
              status: ParcelStatus.AT_HUB,
              currentAgencyId: transfer.destinationAgencyId,
              currentTransferId: null,
            },
          });

          await tx.trackingEvent.create({
            data: {
              shipmentId: parcel.shipmentId,
              parcelId: parcel.id,
              agencyId: transfer.destinationAgencyId,
              userId: user.id,
              eventType: "TRANSFER_RECEIVED",
              source: TrackingEventSource.SCAN,
              status: ParcelStatus.AT_HUB,
              previousStatus: ParcelStatus.IN_TRANSIT,
              notes: `Réceptionné sur quai (${transfer.destinationAgency?.code || transfer.destinationAgencyId}) depuis transfert ${transfer.transferNumber || transfer.number}`,
            },
          });
        } else {
          // Parcel missing from truck
          missingCount++;
          const note =
            dto.missingParcelNotes?.[parcel.id] ||
            (parcel.trackingNumber &&
              dto.missingParcelNotes?.[parcel.trackingNumber]) ||
            "Colis manquant constaté lors du déchargement";

          missingParcels.push({
            parcelId: parcel.id,
            trackingNumber: parcel.trackingNumber || parcel.id,
            notes: note,
          });

          await tx.transferItem.update({
            where: { id: item.id },
            data: {
              status: TransferItemStatus.MISSING,
              discrepancyNote: note,
              receivedAt: null,
            },
          });

          await tx.parcel.update({
            where: { id: parcel.id },
            data: {
              status: ParcelStatus.LOST,
              currentAgencyId: null, // Still nowhere physically
              currentTransferId: null,
            },
          });

          await tx.trackingEvent.create({
            data: {
              shipmentId: parcel.shipmentId,
              parcelId: parcel.id,
              agencyId: transfer.destinationAgencyId,
              userId: user.id,
              eventType: "PARCEL_MISSING_AT_TRANSFER_RECEPTION",
              source: TrackingEventSource.SYSTEM,
              status: ParcelStatus.LOST,
              previousStatus: ParcelStatus.IN_TRANSIT,
              notes: `Alerte manquant au déchargement : ${note}`,
            },
          });
        }
      }

      // 5. Finalize transfer record
      const finalStatus =
        missingCount > 0
          ? TransferStatus.RECEIVED_WITH_DISCREPANCY
          : TransferStatus.RECEIVED;

      const receptionNote =
        missingCount > 0
          ? `[Réception avec écart : ${missingCount} manquant(s)]`
          : "[Réception complète]";

      const finalNotes = dto.notes
        ? `${transfer.notes || ""}\n${receptionNote} ${dto.notes}`.trim()
        : `${transfer.notes || ""}\n${receptionNote}`.trim();

      const savedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: finalStatus,
          totalReceivedParcels: receivedCount,
          receivedAt: now,
          receivedByUserId: user.id,
          notes: finalNotes,
        },
      });

      // 6. Recalculate parent shipments global status
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

      // 7. Security audit on discrepancies
      if (missingCount > 0) {
        await this.auditService.logEvent({
          eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
          userId: user.id,
          identifier: user.email,
          metadata: {
            action: "TRANSFER_DISCREPANCY_DETECTED",
            transferId,
            transferNumber: transfer.transferNumber || transfer.number,
            totalExpected: transfer.totalExpectedParcels,
            receivedCount,
            missingCount,
            missingParcels,
          },
        });
      }

      return savedTransfer;
    });

    // 8. Publish domain event post-commit
    await this.eventBus.publish(
      new TransferReceivedEvent({
        transferId: updatedTransfer.id,
        transferNumber: updatedTransfer.transferNumber || updatedTransfer.number,
        originAgencyId: transfer.originAgencyId,
        destinationAgencyId: transfer.destinationAgencyId,
        receivedByUserId: user.id,
        receivedCount,
        missingCount,
        hasDiscrepancy: missingCount > 0,
        missingParcelIds: missingParcels.map((p) => p.parcelId),
      }),
    );

    return {
      transfer: {
        ...updatedTransfer,
        totalMissingParcels: missingCount,
      },
      receivedCount,
      missingCount,
      hasDiscrepancy: missingCount > 0,
      missingParcels,
    };
  }
}
