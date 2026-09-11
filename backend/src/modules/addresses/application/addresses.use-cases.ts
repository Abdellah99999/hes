import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Address } from "@prisma/client";
import {
  ADDRESS_REPOSITORY,
  IAddressRepository,
  AddressWithRelations,
} from "../domain/address.repository.interface";
import { CreateAddressDto } from "../dto/create-address.dto";
import { UpdateAddressDto } from "../dto/update-address.dto";
import { AddressQueryDto } from "../dto/address-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

@Injectable()
export class AddressesUseCases {
  constructor(
    @Inject(ADDRESS_REPOSITORY)
    private readonly repo: IAddressRepository,
  ) {}

  async create(
    dto: CreateAddressDto,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations> {
    return this.repo.create(dto, user.agencyId || "", user);
  }

  async findAll(
    query: AddressQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<AddressWithRelations>> {
    return this.repo.findAll(query, user);
  }

  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations> {
    const address = await this.repo.findById(id, user);
    if (!address) {
      throw new NotFoundException("Adresse introuvable.");
    }
    return address;
  }

  async update(
    id: string,
    dto: UpdateAddressDto,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations> {
    return this.repo.update(id, dto, user);
  }

  async delete(id: string, user: AuthenticatedUser): Promise<Address> {
    return this.repo.softDelete(id, user);
  }
}
