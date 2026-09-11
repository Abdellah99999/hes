import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
  CustomerWithRelations,
} from "../../domain/customer.repository.interface";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class GetCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CustomerWithRelations> {
    const customer = await this.customerRepo.findById(id, user);
    if (!customer) {
      throw new NotFoundException("Client introuvable.");
    }
    return customer;
  }
}
