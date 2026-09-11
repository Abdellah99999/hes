import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Zone } from "@prisma/client";
import {
  ZONE_REPOSITORY,
  IZoneRepository,
} from "../../domain/zone.repository.interface";
import { CreateZoneDto } from "../../dto/create-zone.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class CreateZoneUseCase {
  constructor(
    @Inject(ZONE_REPOSITORY)
    private readonly zoneRepo: IZoneRepository,
  ) {}

  async execute(dto: CreateZoneDto, user: AuthenticatedUser): Promise<Zone> {
    const targetAgencyId = user.isGlobalScope
      ? dto.agencyId || user.agencyId
      : user.agencyId;

    if (!targetAgencyId) {
      throw new BadRequestException(
        "Identifiant d'agence requis pour créer une zone.",
      );
    }

    const existing = await this.zoneRepo.findByCodeInAgency(
      targetAgencyId,
      dto.code,
    );
    if (existing) {
      throw new ConflictException(
        `Une zone avec le code "${dto.code.toUpperCase()}" existe déjà dans cette agence.`,
      );
    }

    return this.zoneRepo.create(dto, targetAgencyId);
  }
}
