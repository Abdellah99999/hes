import { Module } from "@nestjs/common";
import { RunsController } from "./runs.controller";
import { UpsertCourierProfileUseCase } from "./application/use-cases/upsert-courier-profile.use-case";
import { AutoAssignRunsUseCase } from "./application/use-cases/auto-assign-runs.use-case";
import { ReassignParcelRunUseCase } from "./application/use-cases/reassign-parcel-run.use-case";
import { ListDeliveryRunsUseCase } from "./application/use-cases/list-delivery-runs.use-case";
import { GetDeliveryRunUseCase } from "./application/use-cases/get-delivery-run.use-case";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { EventBusModule } from "../../common/events/event-bus.module";

@Module({
  imports: [PrismaModule, AuthModule, EventBusModule],
  controllers: [RunsController],
  providers: [
    UpsertCourierProfileUseCase,
    AutoAssignRunsUseCase,
    ReassignParcelRunUseCase,
    ListDeliveryRunsUseCase,
    GetDeliveryRunUseCase,
  ],
  exports: [
    UpsertCourierProfileUseCase,
    AutoAssignRunsUseCase,
    ReassignParcelRunUseCase,
    ListDeliveryRunsUseCase,
    GetDeliveryRunUseCase,
  ],
})
export class RunsModule {}
