import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  IShipmentRepository,
  SHIPMENT_REPOSITORY,
  ShipmentWithRelations,
} from "../../domain/shipment.repository.interface";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class GetShipmentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly shipmentRepository: IShipmentRepository,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const shipment = await this.shipmentRepository.findById(id, user);
    if (!shipment) {
      throw new NotFoundException("Expédition introuvable.");
    }
    return shipment;
  }

  async executeByTracking(
    trackingNumber: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const shipment = await this.shipmentRepository.findByTrackingNumber(
      trackingNumber,
      user,
    );
    if (!shipment) {
      throw new NotFoundException("Expédition introuvable.");
    }
    return shipment;
  }
}
