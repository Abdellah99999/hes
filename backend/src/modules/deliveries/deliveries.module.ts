import { Module } from "@nestjs/common";
import { DeliveriesController } from "./deliveries.controller";
import { ConfirmDeliveryUseCase } from "./application/use-cases/confirm-delivery.use-case";
import { RecordRefusalUseCase } from "./application/use-cases/record-refusal.use-case";
import { RegisterDeferredPodUseCase } from "./application/use-cases/register-deferred-pod.use-case";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { EventBusModule } from "../../common/events/event-bus.module";

@Module({
  imports: [PrismaModule, AuthModule, EventBusModule],
  controllers: [DeliveriesController],
  providers: [
    ConfirmDeliveryUseCase,
    RecordRefusalUseCase,
    RegisterDeferredPodUseCase,
  ],
  exports: [
    ConfirmDeliveryUseCase,
    RecordRefusalUseCase,
    RegisterDeferredPodUseCase,
  ],
})
export class DeliveriesModule {}
