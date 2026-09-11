import { Injectable, Inject } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
  ManagerAssignmentWithUsers,
} from "../../domain/customer.repository.interface";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class GetCustomerManagerHistoryUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(
    customerId: string,
    user: AuthenticatedUser,
  ): Promise<ManagerAssignmentWithUsers[]> {
    return this.customerRepo.getManagerHistory(customerId, user);
  }
}
