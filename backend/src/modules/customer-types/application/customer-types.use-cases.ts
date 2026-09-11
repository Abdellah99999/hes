import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CustomerType } from "@prisma/client";
import {
  CUSTOMER_TYPE_REPOSITORY,
  ICustomerTypeRepository,
} from "../domain/customer-type.repository.interface";
import { CreateCustomerTypeDto } from "../dto/create-customer-type.dto";
import { UpdateCustomerTypeDto } from "../dto/update-customer-type.dto";
import { CustomerTypeQueryDto } from "../dto/customer-type-query.dto";

@Injectable()
export class CustomerTypeUseCases {
  constructor(
    @Inject(CUSTOMER_TYPE_REPOSITORY)
    private readonly repo: ICustomerTypeRepository,
  ) {}

  async create(dto: CreateCustomerTypeDto): Promise<CustomerType> {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(
        `Le type client avec le code "${dto.code.toUpperCase()}" existe déjà.`,
      );
    }
    return this.repo.create(dto);
  }

  async findAll(query: CustomerTypeQueryDto): Promise<CustomerType[]> {
    return this.repo.findAll(query);
  }

  async findById(id: string): Promise<CustomerType> {
    const item = await this.repo.findById(id);
    if (!item) {
      throw new NotFoundException(`Type client introuvable.`);
    }
    return item;
  }

  async update(id: string, dto: UpdateCustomerTypeDto): Promise<CustomerType> {
    await this.findById(id);
    return this.repo.update(id, dto);
  }

  async delete(id: string): Promise<CustomerType> {
    const item = await this.findById(id);
    const systemCodes = [
      "STANDARD",
      "BUSINESS",
      "VIP",
      "ENTERPRISE",
      "DEFAULT",
    ];
    if (systemCodes.includes(item.code.toUpperCase())) {
      throw new BadRequestException(
        `Impossible de supprimer un type client système protégé.`,
      );
    }
    return this.repo.delete(id);
  }
}
