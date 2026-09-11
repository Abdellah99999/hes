import { Injectable, Inject } from "@nestjs/common";
import {
  IShipmentRepository,
  SHIPMENT_REPOSITORY,
  ShipmentWithRelations,
} from "../../domain/shipment.repository.interface";
import { UpdateParcelStatusDto } from "../../dto/update-parcel-status.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class UpdateParcelStatusUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly shipmentRepository: IShipmentRepository,
  ) {}

  async execute(
    parcelId: string,
    dto: UpdateParcelStatusDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    return this.shipmentRepository.updateParcelStatus(parcelId, dto, user);
  }
}
