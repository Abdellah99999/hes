import { Injectable, ConflictException, Inject } from "@nestjs/common";
import { Agency } from "@prisma/client";
import {
  AGENCY_REPOSITORY,
  IAgencyRepository,
} from "../../domain/agency.repository.interface";
import { CreateAgencyDto } from "../../dto/create-agency.dto";

@Injectable()
export class CreateAgencyUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepo: IAgencyRepository,
  ) {}

  async execute(dto: CreateAgencyDto): Promise<Agency> {
    const existing = await this.agencyRepo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(
        `Une agence avec le code "${dto.code.toUpperCase()}" existe déjà.`,
      );
    }
    return this.agencyRepo.create(dto);
  }
}
