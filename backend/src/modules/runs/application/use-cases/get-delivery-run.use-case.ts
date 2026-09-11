import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class GetDeliveryRunUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, user: AuthenticatedUser) {
    const run = await this.prisma.deliveryRun.findFirst({
      where: {
        OR: [{ id }, { number: id }],
      },
      include: {
        agency: true,
        zone: true,
        courier: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        runItems: {
          include: {
            parcel: {
              include: { shipment: true },
            },
          },
          orderBy: { sequenceOrder: "asc" },
        },
      } as any,
    });

    if (!run) {
      throw new NotFoundException("Tournée de livraison introuvable.");
    }

    // Security isolation check
    if (user.role === "COURIER" && (run.courier as any)?.userId !== user.id) {
      throw new ForbiddenException(
        "Accès refusé : vous ne pouvez consulter que vos propres tournées.",
      );
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== run.agencyId
    ) {
      throw new ForbiddenException(
        "Accès refusé : cette tournée ne concerne pas votre agence.",
      );
    }

    return {
      ...run,
      runNumber: (run as any).number || (run as any).runNumber,
      items: (run as any).runItems || (run as any).items || [],
    };
  }
}
