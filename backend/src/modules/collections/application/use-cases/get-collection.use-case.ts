import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class GetCollectionUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, user: AuthenticatedUser) {
    const collection = await this.prisma.collection.findFirst({
      where: {
        OR: [{ id }, { collectionNumber: id }],
        deletedAt: null,
      },
      include: {
        customer: true,
        agency: true,
        zone: true,
        address: true,
        assignedCourier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        items: {
          include: {
            generatedParcel: true,
          },
          orderBy: { itemIndex: "asc" },
        },
        shipment: {
          include: {
            parcels: true,
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException("Demande de collecte introuvable.");
    }

    // Role-based security checks
    if (user.role === "CUSTOMER" && collection.customerId !== user.customerId) {
      throw new ForbiddenException(
        "Accès refusé : cette demande de collecte ne vous appartient pas.",
      );
    }

    if (
      user.role === "COURIER" &&
      collection.assignedCourierId &&
      collection.assignedCourierId !== user.id
    ) {
      throw new ForbiddenException(
        "Accès refusé : cette mission de collecte ne vous est pas assignée.",
      );
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.role !== "CUSTOMER" &&
      collection.agencyId !== user.agencyId
    ) {
      throw new ForbiddenException(
        "Accès refusé : cette collecte ne concerne pas votre agence.",
      );
    }

    return collection;
  }
}
