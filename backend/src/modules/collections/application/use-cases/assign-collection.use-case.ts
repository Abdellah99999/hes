import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { AssignCollectionDto } from "../../dto/assign-collection.dto";
import { CollectionStatus } from "@prisma/client";

@Injectable()
export class AssignCollectionUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    collectionId: string,
    dto: AssignCollectionDto,
    user: AuthenticatedUser,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException("Demande de collecte introuvable.");
    }

    // 1. Check dispatcher agency scope
    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== collection.agencyId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez affecter que les collectes rattachées à votre agence.",
      );
    }

    // 2. Validate current collection state
    if (
      collection.status !== CollectionStatus.REQUESTED &&
      collection.status !== CollectionStatus.ASSIGNED
    ) {
      throw new BadRequestException(
        `Impossible d'affecter une collecte au statut '${collection.status}' (statut requis : REQUESTED ou ASSIGNED).`,
      );
    }

    // 3. Validate courier
    const courier = await this.prisma.user.findUnique({
      where: { id: dto.courierId },
      include: { role: true },
    });

    if (!courier || !courier.isActive) {
      throw new NotFoundException(
        "Agent de collecte / coursier introuvable ou inactif.",
      );
    }

    if (courier.agencyId && courier.agencyId !== collection.agencyId) {
      throw new BadRequestException(
        "Le coursier sélectionné n'appartient pas à l'agence de la collecte.",
      );
    }

    // 4. Update assignment
    return this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        status: CollectionStatus.ASSIGNED,
        assignedCourierId: courier.id,
        assignedToUserId: courier.id,
        assignedAt: new Date(),
      },
      include: {
        customer: true,
        assignedCourier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        items: true,
      },
    });
  }
}
