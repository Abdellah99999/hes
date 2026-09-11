import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AgenciesController } from "./agencies.controller";
import { AGENCY_REPOSITORY } from "./domain/agency.repository.interface";
import { PrismaAgencyRepository } from "./infrastructure/prisma-agency.repository";
import { CreateAgencyUseCase } from "./application/use-cases/create-agency.use-case";
import { UpdateAgencyUseCase } from "./application/use-cases/update-agency.use-case";
import { GetAgencyUseCase } from "./application/use-cases/get-agency.use-case";
import { ListAgenciesUseCase } from "./application/use-cases/list-agencies.use-case";
import { DeleteAgencyUseCase } from "./application/use-cases/delete-agency.use-case";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AgenciesController],
  providers: [
    {
      provide: AGENCY_REPOSITORY,
      useClass: PrismaAgencyRepository,
    },
    CreateAgencyUseCase,
    UpdateAgencyUseCase,
    GetAgencyUseCase,
    ListAgenciesUseCase,
    DeleteAgencyUseCase,
  ],
  exports: [AGENCY_REPOSITORY, GetAgencyUseCase],
})
export class AgenciesModule {}
