import { Injectable, Inject } from "@nestjs/common";
import { Agency } from "@prisma/client";
import {
  AGENCY_REPOSITORY,
  IAgencyRepository,
} from "../../domain/agency.repository.interface";
import { AgencyQueryDto } from "../../dto/agency-query.dto";
import { PaginatedResult } from "../../../../common/dto/pagination-query.dto";

@Injectable()
export class ListAgenciesUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepo: IAgencyRepository,
  ) {}

  async execute(query: AgencyQueryDto): Promise<PaginatedResult<Agency>> {
    return this.agencyRepo.findAll(query);
  }
}
