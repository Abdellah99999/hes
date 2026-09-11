import { Module } from "@nestjs/common";
import { CollectionsController } from "./collections.controller";
import { RequestCollectionUseCase } from "./application/use-cases/request-collection.use-case";
import { AssignCollectionUseCase } from "./application/use-cases/assign-collection.use-case";
import { CompleteCollectionUseCase } from "./application/use-cases/complete-collection.use-case";
import { ListCollectionsUseCase } from "./application/use-cases/list-collections.use-case";
import { GetCollectionUseCase } from "./application/use-cases/get-collection.use-case";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ShipmentsModule } from "../shipments/shipments.module";

@Module({
  imports: [PrismaModule, AuthModule, ShipmentsModule],
  controllers: [CollectionsController],
  providers: [
    RequestCollectionUseCase,
    AssignCollectionUseCase,
    CompleteCollectionUseCase,
    ListCollectionsUseCase,
    GetCollectionUseCase,
  ],
  exports: [
    RequestCollectionUseCase,
    AssignCollectionUseCase,
    CompleteCollectionUseCase,
    ListCollectionsUseCase,
    GetCollectionUseCase,
  ],
})
export class CollectionsModule {}
