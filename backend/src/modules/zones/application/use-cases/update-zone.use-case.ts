import { Injectable, Inject } from "@nestjs/common";
import { Zone } from "@prisma/client";
import {
  ZONE_REPOSITORY,
  IZoneRepository,
} from "../../domain/zone.repository.interface";
import { UpdateZoneDto } from "../../dto/update-zone.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class UpdateZoneUseCase {
  constructor(
    @Inject(ZONE_REPOSITORY)
    private readonly zoneRepo: IZoneRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateZoneDto,
    user: AuthenticatedUser,
  ): Promise<Zone> {
    return this.zoneRepo.update(id, dto, user);
  }
}
