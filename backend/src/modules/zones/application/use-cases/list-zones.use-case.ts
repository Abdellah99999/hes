import { Injectable, Inject } from "@nestjs/common";
import { Zone } from "@prisma/client";
import {
  ZONE_REPOSITORY,
  IZoneRepository,
} from "../../domain/zone.repository.interface";
import { ZoneQueryDto } from "../../dto/zone-query.dto";
import { PaginatedResult } from "../../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class ListZonesUseCase {
  constructor(
    @Inject(ZONE_REPOSITORY)
    private readonly zoneRepo: IZoneRepository,
  ) {}

  async execute(
    query: ZoneQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<Zone>> {
    return this.zoneRepo.findAll(query, user);
  }
}
