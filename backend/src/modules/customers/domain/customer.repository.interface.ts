import { Customer, Prisma } from "@prisma/client";
import { CreateCustomerDto } from "../dto/create-customer.dto";
import { UpdateCustomerDto } from "../dto/update-customer.dto";
import { CustomerQueryDto } from "../dto/customer-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

export const CUSTOMER_REPOSITORY = "CUSTOMER_REPOSITORY";

export type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: {
    agency: true;
    customerType: true;
    managerAssignments: {
      include: {
        user: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            email: true;
          };
        };
        assignedBy: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            email: true;
          };
        };
      };
    };
    contacts: true;
    addresses: true;
  };
}>;

export type ManagerAssignmentWithUsers =
  Prisma.CustomerInternalManagerGetPayload<{
    include: {
      user: {
        select: {
          id: true;
          firstName: true;
          lastName: true;
          email: true;
        };
      };
      assignedBy: {
        select: {
          id: true;
          firstName: true;
          lastName: true;
          email: true;
        };
      };
    };
  }>;

export interface ICustomerRepository {
  create(
    dto: CreateCustomerDto,
    agencyId: string,
    assignedByUserId: string,
  ): Promise<CustomerWithRelations>;

  findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CustomerWithRelations | null>;

  findByCode(code: string): Promise<Customer | null>;

  findAll(
    query: CustomerQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<CustomerWithRelations>>;

  update(
    id: string,
    dto: UpdateCustomerDto,
    user: AuthenticatedUser,
  ): Promise<CustomerWithRelations>;

  softDelete(id: string, user: AuthenticatedUser): Promise<Customer>;

  assignManager(
    customerId: string,
    newManagerUserId: string,
    reason: string | undefined,
    assignedByUserId: string,
    user: AuthenticatedUser,
  ): Promise<ManagerAssignmentWithUsers>;

  getManagerHistory(
    customerId: string,
    user: AuthenticatedUser,
  ): Promise<ManagerAssignmentWithUsers[]>;
}
