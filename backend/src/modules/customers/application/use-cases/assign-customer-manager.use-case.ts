import { Injectable, Inject } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
  ManagerAssignmentWithUsers,
} from "../../domain/customer.repository.interface";
import { AssignManagerDto } from "../../dto/assign-manager.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class AssignCustomerManagerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(
    customerId: string,
    dto: AssignManagerDto,
    user: AuthenticatedUser,
  ): Promise<ManagerAssignmentWithUsers> {
    return this.customerRepo.assignManager(
      customerId,
      dto.userId,
      dto.assignmentReason,
      user.id,
      user,
    );
  }
}
