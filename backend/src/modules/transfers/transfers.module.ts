import { Module } from "@nestjs/common";
import { TransfersController } from "./transfers.controller";
import { RoutingEngineService } from "./domain/routing-engine.service";
import { CreateTransferUseCase } from "./application/use-cases/create-transfer.use-case";
import { DispatchTransferUseCase } from "./application/use-cases/dispatch-transfer.use-case";
import { ReceiveTransferUseCase } from "./application/use-cases/receive-transfer.use-case";
import { ListTransfersUseCase } from "./application/use-cases/list-transfers.use-case";
import { GetTransferUseCase } from "./application/use-cases/get-transfer.use-case";
import { GetAgencyStockUseCase } from "./application/use-cases/get-agency-stock.use-case";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TransfersController],
  providers: [
    RoutingEngineService,
    CreateTransferUseCase,
    DispatchTransferUseCase,
    ReceiveTransferUseCase,
    ListTransfersUseCase,
    GetTransferUseCase,
    GetAgencyStockUseCase,
  ],
  exports: [
    RoutingEngineService,
    CreateTransferUseCase,
    DispatchTransferUseCase,
    ReceiveTransferUseCase,
    ListTransfersUseCase,
    GetTransferUseCase,
    GetAgencyStockUseCase,
  ],
})
export class TransfersModule {}
