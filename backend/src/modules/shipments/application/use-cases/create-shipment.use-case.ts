import { Injectable, Inject, Optional } from "@nestjs/common";
import {
  IShipmentRepository,
  SHIPMENT_REPOSITORY,
  ShipmentWithRelations,
} from "../../domain/shipment.repository.interface";
import { CreateShipmentDto } from "../../dto/create-shipment.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { ShipmentRegisteredEvent } from "../../../../common/events/shipment.events";
import { ShipmentStatus } from "@prisma/client";

@Injectable()
export class CreateShipmentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly shipmentRepository: IShipmentRepository,
    @Optional()
    private readonly eventBus?: EventBusService,
  ) {}

  async execute(
    dto: CreateShipmentDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const created = await this.shipmentRepository.create(dto, user);

    if (this.eventBus) {
      const trackingNumber =
        created.trackingNumber || created.number || "HES-PENDING";
      await this.eventBus.publish(
        new ShipmentRegisteredEvent({
          shipmentId: created.id,
          trackingNumber,
          originAgencyId: created.originAgencyId,
          destinationAgencyId: created.destinationAgencyId,
          senderCustomerId: created.senderCustomerId,
          recipientName: created.recipientName,
          recipientPhone: created.recipientPhone,
          totalParcels: created.totalParcels,
          codAmount: created.codAmount ? Number(created.codAmount) : null,
          status:
            (created.status as ShipmentStatus) || ShipmentStatus.REGISTERED,
          createdById: user.id,
          registeredAt: new Date(),
        }),
      );
    }

    return created;
  }
}
