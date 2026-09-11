import { Injectable, Inject } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
  CustomerWithRelations,
} from "../../domain/customer.repository.interface";
import { CustomerQueryDto } from "../../dto/customer-query.dto";
import { PaginatedResult } from "../../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class ListCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(
    query: CustomerQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<CustomerWithRelations>> {
    return this.customerRepo.findAll(query, user);
  }
}
