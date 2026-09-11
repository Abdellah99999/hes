import { Injectable } from "@nestjs/common";
import { Prisma, CustomerType } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { ICustomerTypeRepository } from "../domain/customer-type.repository.interface";
import { CreateCustomerTypeDto } from "../dto/create-customer-type.dto";
import { UpdateCustomerTypeDto } from "../dto/update-customer-type.dto";
import { CustomerTypeQueryDto } from "../dto/customer-type-query.dto";

@Injectable()
export class PrismaCustomerTypeRepository implements ICustomerTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerTypeDto): Promise<CustomerType> {
    return this.prisma.customerType.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
      },
    });
  }

  async findById(id: string): Promise<CustomerType | null> {
    return this.prisma.customerType.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string): Promise<CustomerType | null> {
    return this.prisma.customerType.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
  }

  async findAll(query: CustomerTypeQueryDto): Promise<CustomerType[]> {
    const where: Prisma.CustomerTypeWhereInput = {
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.customerType.findMany({
      where,
      orderBy: { code: "asc" },
    });
  }

  async update(id: string, dto: UpdateCustomerTypeDto): Promise<CustomerType> {
    return this.prisma.customerType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      },
    });
  }

  async delete(id: string): Promise<CustomerType> {
    return this.prisma.customerType.delete({
      where: { id },
    });
  }
}
