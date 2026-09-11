import { Injectable, Inject } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
  CustomerWithRelations,
} from "../../domain/customer.repository.interface";
import { UpdateCustomerDto } from "../../dto/update-customer.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateCustomerDto,
    user: AuthenticatedUser,
  ): Promise<CustomerWithRelations> {
    return this.customerRepo.update(id, dto, user);
  }
}
