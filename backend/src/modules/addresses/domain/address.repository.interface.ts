import { Address, Prisma } from "@prisma/client";
import { CreateAddressDto } from "../dto/create-address.dto";
import { UpdateAddressDto } from "../dto/update-address.dto";
import { AddressQueryDto } from "../dto/address-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

export const ADDRESS_REPOSITORY = "ADDRESS_REPOSITORY";

export type AddressWithRelations = Prisma.AddressGetPayload<{
  include: {
    agency: true;
    customer: true;
    zone: true;
  };
}>;

export interface IAddressRepository {
  create(
    dto: CreateAddressDto,
    agencyId: string,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations>;

  findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations | null>;

  findAll(
    query: AddressQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<AddressWithRelations>>;

  update(
    id: string,
    dto: UpdateAddressDto,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations>;

  softDelete(id: string, user: AuthenticatedUser): Promise<Address>;
}
