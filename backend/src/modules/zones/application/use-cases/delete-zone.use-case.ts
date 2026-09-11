import { Injectable, Inject } from "@nestjs/common";
import { Zone } from "@prisma/client";
import {
  ZONE_REPOSITORY,
  IZoneRepository,
} from "../../domain/zone.repository.interface";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class DeleteZoneUseCase {
  constructor(
    @Inject(ZONE_REPOSITORY)
    private readonly zoneRepo: IZoneRepository,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Zone> {
    return this.zoneRepo.softDelete(id, user);
  }
}
