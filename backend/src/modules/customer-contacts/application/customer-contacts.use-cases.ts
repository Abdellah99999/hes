import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { CustomerContact } from "@prisma/client";
import {
  CUSTOMER_CONTACT_REPOSITORY,
  ICustomerContactRepository,
} from "../domain/customer-contact.repository.interface";
import { CreateCustomerContactDto } from "../dto/create-customer-contact.dto";
import { UpdateCustomerContactDto } from "../dto/update-customer-contact.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

@Injectable()
export class CustomerContactsUseCases {
  constructor(
    @Inject(CUSTOMER_CONTACT_REPOSITORY)
    private readonly repo: ICustomerContactRepository,
  ) {}

  async create(
    dto: CreateCustomerContactDto,
    user: AuthenticatedUser,
  ): Promise<CustomerContact> {
    return this.repo.create(dto, user.agencyId || "", user);
  }

  async findByCustomerId(
    customerId: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact[]> {
    return this.repo.findByCustomerId(customerId, user);
  }

  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact> {
    const contact = await this.repo.findById(id, user);
    if (!contact) {
      throw new NotFoundException("Contact introuvable.");
    }
    return contact;
  }

  async update(
    id: string,
    dto: UpdateCustomerContactDto,
    user: AuthenticatedUser,
  ): Promise<CustomerContact> {
    return this.repo.update(id, dto, user);
  }

  async delete(id: string, user: AuthenticatedUser): Promise<CustomerContact> {
    return this.repo.softDelete(id, user);
  }
}
