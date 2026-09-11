import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Zone } from "@prisma/client";
import {
  ZONE_REPOSITORY,
  IZoneRepository,
} from "../../domain/zone.repository.interface";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class GetZoneUseCase {
  constructor(
    @Inject(ZONE_REPOSITORY)
    private readonly zoneRepo: IZoneRepository,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Zone> {
    const zone = await this.zoneRepo.findById(id, user);
    if (!zone) {
      throw new NotFoundException("Zone introuvable.");
    }
    return zone;
  }
}
