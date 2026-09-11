import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { UpsertCourierProfileDto } from "../../dto/upsert-courier-profile.dto";

@Injectable()
export class UpsertCourierProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertCourierProfileDto, user: AuthenticatedUser) {
    // 1. Verify target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { role: true },
    });

    if (!targetUser) {
      throw new NotFoundException("Utilisateur introuvable.");
    }

    const agencyId = targetUser.agencyId || user.agencyId;
    if (!agencyId) {
      throw new NotFoundException(
        "L'utilisateur doit être rattaché à une agence.",
      );
    }

    if (!user.isGlobalScope && user.agencyId && user.agencyId !== agencyId) {
      throw new ForbiddenException(
        "Vous ne pouvez gérer que les livreurs de votre propre agence.",
      );
    }

    // Update primary zone on user if provided
    if (dto.primaryZoneId) {
      await this.prisma.user.update({
        where: { id: dto.userId },
        data: { zoneId: dto.primaryZoneId },
      });
    }

    // 2. Upsert profile
    const profileData = {
      agencyId,
      vehicleType: dto.vehicleType,
      vehiclePlate: dto.licensePlate?.trim() ?? null,
      maxWeightKg: dto.maxCapacityKg ?? 50.0,
      maxDailyParcels: dto.maxParcelsCapacity ?? 30,
    };

    return this.prisma.courierProfile.upsert({
      where: { userId: dto.userId },
      create: {
        userId: dto.userId,
        ...profileData,
      },
      update: {
        ...profileData,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            zone: true,
          },
        },
        agency: { select: { id: true, code: true, name: true } },
      },
    });
  }
}
