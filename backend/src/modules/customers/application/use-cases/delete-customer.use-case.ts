import { Injectable, Inject } from "@nestjs/common";
import { Customer } from "@prisma/client";
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
} from "../../domain/customer.repository.interface";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class DeleteCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Customer> {
    return this.customerRepo.softDelete(id, user);
  }
}
