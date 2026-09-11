import { Zone } from "@prisma/client";
import { CreateZoneDto } from "../dto/create-zone.dto";
import { UpdateZoneDto } from "../dto/update-zone.dto";
import { ZoneQueryDto } from "../dto/zone-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

export const ZONE_REPOSITORY = "ZONE_REPOSITORY";

export interface IZoneRepository {
  create(dto: CreateZoneDto, agencyId: string): Promise<Zone>;
  findById(id: string, user: AuthenticatedUser): Promise<Zone | null>;
  findByCodeInAgency(agencyId: string, code: string): Promise<Zone | null>;
  findAll(
    query: ZoneQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<Zone>>;
  update(
    id: string,
    dto: UpdateZoneDto,
    user: AuthenticatedUser,
  ): Promise<Zone>;
  softDelete(id: string, user: AuthenticatedUser): Promise<Zone>;
}
