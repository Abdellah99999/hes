import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ZonesController } from "./zones.controller";
import { ZONE_REPOSITORY } from "./domain/zone.repository.interface";
import { PrismaZoneRepository } from "./infrastructure/prisma-zone.repository";
import { CreateZoneUseCase } from "./application/use-cases/create-zone.use-case";
import { UpdateZoneUseCase } from "./application/use-cases/update-zone.use-case";
import { GetZoneUseCase } from "./application/use-cases/get-zone.use-case";
import { ListZonesUseCase } from "./application/use-cases/list-zones.use-case";
import { DeleteZoneUseCase } from "./application/use-cases/delete-zone.use-case";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ZonesController],
  providers: [
    {
      provide: ZONE_REPOSITORY,
      useClass: PrismaZoneRepository,
    },
    CreateZoneUseCase,
    UpdateZoneUseCase,
    GetZoneUseCase,
    ListZonesUseCase,
    DeleteZoneUseCase,
  ],
  exports: [ZONE_REPOSITORY, GetZoneUseCase],
})
export class ZonesModule {}
