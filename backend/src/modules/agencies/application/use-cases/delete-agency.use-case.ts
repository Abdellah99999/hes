import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Agency } from "@prisma/client";
import {
  AGENCY_REPOSITORY,
  IAgencyRepository,
} from "../../domain/agency.repository.interface";

@Injectable()
export class DeleteAgencyUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepo: IAgencyRepository,
  ) {}

  async execute(id: string): Promise<Agency> {
    const existing = await this.agencyRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Agence introuvable.`);
    }
    return this.agencyRepo.softDelete(id);
  }
}
