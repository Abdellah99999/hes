import { Agency } from "@prisma/client";
import { CreateAgencyDto } from "../dto/create-agency.dto";
import { UpdateAgencyDto } from "../dto/update-agency.dto";
import { AgencyQueryDto } from "../dto/agency-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";

export const AGENCY_REPOSITORY = "AGENCY_REPOSITORY";

export interface IAgencyRepository {
  create(dto: CreateAgencyDto): Promise<Agency>;
  findById(id: string): Promise<Agency | null>;
  findByCode(code: string): Promise<Agency | null>;
  findAll(query: AgencyQueryDto): Promise<PaginatedResult<Agency>>;
  update(id: string, dto: UpdateAgencyDto): Promise<Agency>;
  softDelete(id: string): Promise<Agency>;
  countActive(): Promise<number>;
}
