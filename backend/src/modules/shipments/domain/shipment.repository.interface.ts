import { Prisma } from "@prisma/client";
import { CreateShipmentDto } from "../dto/create-shipment.dto";
import { ShipmentQueryDto } from "../dto/shipment-query.dto";
import { UpdateParcelStatusDto } from "../dto/update-parcel-status.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

export const SHIPMENT_REPOSITORY = "SHIPMENT_REPOSITORY";

export type ShipmentWithRelations = Prisma.ShipmentGetPayload<{
  include: {
    originAgency: true;
    destinationAgency: true;
    senderCustomer: true;
    createdByUser: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
    parcels: {
      include: {
        parcelType: true;
        items: true;
      };
    };
  };
}>;

export interface IShipmentRepository {
  create(
    dto: CreateShipmentDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations>;

  findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations | null>;

  findByTrackingNumber(
    trackingNumber: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations | null>;

  findAll(
    query: ShipmentQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<ShipmentWithRelations>>;

  updateParcelStatus(
    parcelId: string,
    dto: UpdateParcelStatusDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations>;
}
