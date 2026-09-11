import { CustomerContact } from "@prisma/client";
import { CreateCustomerContactDto } from "../dto/create-customer-contact.dto";
import { UpdateCustomerContactDto } from "../dto/update-customer-contact.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

export const CUSTOMER_CONTACT_REPOSITORY = "CUSTOMER_CONTACT_REPOSITORY";

export interface ICustomerContactRepository {
  create(
    dto: CreateCustomerContactDto,
    agencyId: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact>;

  findByCustomerId(
    customerId: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact[]>;

  findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact | null>;

  update(
    id: string,
    dto: UpdateCustomerContactDto,
    user: AuthenticatedUser,
  ): Promise<CustomerContact>;

  softDelete(id: string, user: AuthenticatedUser): Promise<CustomerContact>;
}
