import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Agency } from "@prisma/client";
import {
  AGENCY_REPOSITORY,
  IAgencyRepository,
} from "../../domain/agency.repository.interface";
import { UpdateAgencyDto } from "../../dto/update-agency.dto";

@Injectable()
export class UpdateAgencyUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepo: IAgencyRepository,
  ) {}

  async execute(id: string, dto: UpdateAgencyDto): Promise<Agency> {
    const existing = await this.agencyRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Agence introuvable.`);
    }
    return this.agencyRepo.update(id, dto);
  }
}
