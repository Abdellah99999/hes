import { Module } from "@nestjs/common";
import { ShipmentsController } from "./shipments.controller";
import { CreateShipmentUseCase } from "./application/use-cases/create-shipment.use-case";
import { GetShipmentUseCase } from "./application/use-cases/get-shipment.use-case";
import { ListShipmentsUseCase } from "./application/use-cases/list-shipments.use-case";
import { UpdateParcelStatusUseCase } from "./application/use-cases/update-parcel-status.use-case";
import { ProcessTrackingEventUseCase } from "./application/use-cases/process-tracking-event.use-case";
import { GetTrackingTimelineUseCase } from "./application/use-cases/get-tracking-timeline.use-case";
import { BarcodeService } from "./domain/barcode.service";
import { SHIPMENT_REPOSITORY } from "./domain/shipment.repository.interface";
import { PrismaShipmentRepository } from "./infrastructure/prisma-shipment.repository";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { EventBusModule } from "../../common/events/event-bus.module";

@Module({
  imports: [PrismaModule, AuthModule, EventBusModule],
  controllers: [ShipmentsController],
  providers: [
    BarcodeService,
    CreateShipmentUseCase,
    GetShipmentUseCase,
    ListShipmentsUseCase,
    UpdateParcelStatusUseCase,
    ProcessTrackingEventUseCase,
    GetTrackingTimelineUseCase,
    {
      provide: SHIPMENT_REPOSITORY,
      useClass: PrismaShipmentRepository,
    },
  ],
  exports: [
    SHIPMENT_REPOSITORY,
    BarcodeService,
    CreateShipmentUseCase,
    GetShipmentUseCase,
    ListShipmentsUseCase,
    UpdateParcelStatusUseCase,
    ProcessTrackingEventUseCase,
    GetTrackingTimelineUseCase,
  ],
})
export class ShipmentsModule {}
