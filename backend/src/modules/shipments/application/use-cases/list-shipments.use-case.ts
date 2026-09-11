import { Injectable, Inject } from "@nestjs/common";
import {
  IShipmentRepository,
  SHIPMENT_REPOSITORY,
  ShipmentWithRelations,
} from "../../domain/shipment.repository.interface";
import { ShipmentQueryDto } from "../../dto/shipment-query.dto";
import { PaginatedResult } from "../../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class ListShipmentsUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly shipmentRepository: IShipmentRepository,
  ) {}

  async execute(
    query: ShipmentQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<ShipmentWithRelations>> {
    return this.shipmentRepository.findAll(query, user);
  }
}
