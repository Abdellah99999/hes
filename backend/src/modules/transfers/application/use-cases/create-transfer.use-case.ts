import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { CreateTransferDto } from "../../dto/create-transfer.dto";
import { TransferStatus, TransferItemStatus } from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { TransferCreatedEvent } from "../../../../common/events/transfer.events";

@Injectable()
export class CreateTransferUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CreateTransferDto, user: AuthenticatedUser) {
    // 1. Validate agency scope
    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== dto.originAgencyId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez préparer un transfert qu'au départ de votre propre agence.",
      );
    }

    // 2. Validate agencies
    const originAgency = await this.prisma.agency.findUnique({
      where: { id: dto.originAgencyId },
    });
    if (!originAgency) {
      throw new NotFoundException("Agence de départ introuvable.");
    }

    const destinationAgency = await this.prisma.agency.findUnique({
      where: { id: dto.destinationAgencyId },
    });
    if (!destinationAgency) {
      throw new NotFoundException("Agence de destination introuvable.");
    }

    if (originAgency.id === destinationAgency.id) {
      throw new BadRequestException(
        "L'agence de départ et l'agence de destination ne peuvent pas être identiques.",
      );
    }

    // 3. Validate parcels eligibility
    const parcels = await this.prisma.parcel.findMany({
      where: {
        id: { in: dto.parcelIds },
        deletedAt: null,
      },
      include: { shipment: true },
    });

    if (parcels.length !== dto.parcelIds.length) {
      throw new NotFoundException(
        "Un ou plusieurs colis sélectionnés sont introuvables ou supprimés.",
      );
    }

    for (const p of parcels) {
      if (p.currentAgencyId && p.currentAgencyId !== dto.originAgencyId) {
        throw new BadRequestException(
          `Le colis ${p.trackingNumber || p.id} n'est pas physiquement présent dans l'agence d'origine sélectionnée.`,
        );
      }
      if (p.currentTransferId) {
        throw new BadRequestException(
          `Le colis ${p.trackingNumber || p.id} est déjà assigné à un transfert en cours.`,
        );
      }
      if (
        p.status === "IN_TRANSIT" ||
        p.status === "DELIVERED" ||
        p.status === "CANCELLED"
      ) {
        throw new BadRequestException(
          `Le colis ${p.trackingNumber || p.id} ne peut pas être transféré (statut actuel : ${p.status}).`,
        );
      }
    }

    // 4. Generate transfer number
    const currentYear = new Date().getFullYear();
    const count = await this.prisma.transfer.count({
      where: { originAgencyId: dto.originAgencyId },
    });
    const seq = String(count + 1).padStart(5, "0");
    const transferNumber = `TRF-${originAgency.code}-${destinationAgency.code}-${currentYear}-${seq}`;

    // Format notes with extra transport metadata if present
    const noteSegments: string[] = [];
    if (dto.sealNumber?.trim()) {
      noteSegments.push(`[Plomb: ${dto.sealNumber.trim()}]`);
    }
    if (dto.routeId?.trim()) {
      noteSegments.push(`[Route: ${dto.routeId.trim()}]`);
    }
    if (dto.notes?.trim()) {
      noteSegments.push(dto.notes.trim());
    }
    const combinedNotes =
      noteSegments.length > 0 ? noteSegments.join(" ") : null;

    // 5. Transactional creation
    const createdTransfer = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          number: transferNumber,
          transferNumber,
          originAgencyId: dto.originAgencyId,
          destinationAgencyId: dto.destinationAgencyId,
          createdByUserId: user.id,
          status: TransferStatus.PREPARED,
          vehiclePlate: dto.vehiclePlate?.trim() ?? null,
          driverName: dto.driverName?.trim() ?? null,
          driverPhone: dto.driverPhone?.trim() ?? null,
          notes: combinedNotes,
          totalExpectedParcels: parcels.length,
          totalReceivedParcels: 0,
        },
      });

      // Create items and reserve parcels in batch (Eliminates N+1 query overhead)
      if (tx.transferItem.createMany) {
        await tx.transferItem.createMany({
          data: parcels.map((p) => ({
            transferId: transfer.id,
            parcelId: p.id,
            status: TransferItemStatus.PENDING,
            loadedAt: new Date(),
          })),
        });
      } else {
        for (const p of parcels) {
          await tx.transferItem.create({
            data: {
              transferId: transfer.id,
              parcelId: p.id,
              status: TransferItemStatus.PENDING,
              loadedAt: new Date(),
            },
          });
        }
      }

      if (tx.parcel.updateMany) {
        await tx.parcel.updateMany({
          where: { id: { in: parcels.map((p) => p.id) } },
          data: { currentTransferId: transfer.id },
        });
      } else {
        for (const p of parcels) {
          await tx.parcel.update({
            where: { id: p.id },
            data: { currentTransferId: transfer.id },
          });
        }
      }

      return transfer;
    });

    // 6. Publish domain event post-commit
    await this.eventBus.publish(
      new TransferCreatedEvent({
        transferId: createdTransfer.id,
        transferNumber: createdTransfer.transferNumber || createdTransfer.number,
        originAgencyId: createdTransfer.originAgencyId,
        destinationAgencyId: createdTransfer.destinationAgencyId,
        totalExpectedParcels: parcels.length,
        parcelIds: dto.parcelIds,
        createdByUserId: user.id,
      }),
    );

    return createdTransfer;
  }
}
