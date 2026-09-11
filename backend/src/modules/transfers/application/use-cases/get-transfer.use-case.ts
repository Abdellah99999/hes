import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class GetTransferUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, user: AuthenticatedUser) {
    const rawTransfer = await this.prisma.transfer.findFirst({
      where: {
        OR: [{ id }, { number: id }, { transferNumber: id }],
      },
      include: {
        originAgency: true,
        destinationAgency: true,
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        receivedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        items: {
          include: {
            parcel: {
              include: {
                shipment: {
                  select: {
                    id: true,
                    trackingNumber: true,
                    recipientName: true,
                    destinationAddress: { select: { city: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!rawTransfer) {
      throw new NotFoundException("Transfert introuvable.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      rawTransfer.originAgencyId !== user.agencyId &&
      rawTransfer.destinationAgencyId !== user.agencyId
    ) {
      throw new ForbiddenException(
        "Accès refusé : ce transfert ne concerne pas votre agence.",
      );
    }

    // Format items to provide recipientCity consistently for frontend
    const items = rawTransfer.items.map((item) => ({
      ...item,
      parcel: item.parcel
        ? {
            ...item.parcel,
            shipment: item.parcel.shipment
              ? {
                  id: item.parcel.shipment.id,
                  trackingNumber: item.parcel.shipment.trackingNumber,
                  recipientName: item.parcel.shipment.recipientName,
                  recipientCity:
                    item.parcel.shipment.destinationAddress?.city || "",
                }
              : null,
          }
        : null,
    }));

    return {
      ...rawTransfer,
      items,
    };
  }
}
