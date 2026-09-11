import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
  CustomerWithRelations,
} from "../../domain/customer.repository.interface";
import { CreateCustomerDto } from "../../dto/create-customer.dto";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(
    dto: CreateCustomerDto,
    user: AuthenticatedUser,
  ): Promise<CustomerWithRelations> {
    const targetAgencyId = user.isGlobalScope
      ? dto.agencyId || user.agencyId
      : user.agencyId;

    if (!targetAgencyId) {
      throw new BadRequestException(
        "Identifiant d'agence obligatoire pour rattacher un client.",
      );
    }

    const existing = await this.customerRepo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(
        `Un client avec le code "${dto.code.toUpperCase()}" existe déjà dans le système.`,
      );
    }

    return this.customerRepo.create(dto, targetAgencyId, user.id);
  }
}
