import { Injectable } from "@nestjs/common";
import { Prisma, Agency } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { IAgencyRepository } from "../domain/agency.repository.interface";
import { CreateAgencyDto } from "../dto/create-agency.dto";
import { UpdateAgencyDto } from "../dto/update-agency.dto";
import { AgencyQueryDto } from "../dto/agency-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";

@Injectable()
export class PrismaAgencyRepository implements IAgencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAgencyDto): Promise<Agency> {
    return this.prisma.agency.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        phone: dto.phone?.trim() ?? null,
        email: dto.email?.trim().toLowerCase() ?? null,
        city: dto.city.trim(),
        address: dto.address?.trim() ?? null,
      },
    });
  }

  async findById(id: string): Promise<Agency | null> {
    return this.prisma.agency.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByCode(code: string): Promise<Agency | null> {
    return this.prisma.agency.findFirst({
      where: { code: code.trim().toUpperCase(), deletedAt: null },
    });
  }

  async findAll(query: AgencyQueryDto): Promise<PaginatedResult<Agency>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AgencyWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.agency.count({ where }),
      this.prisma.agency.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: "asc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async update(id: string, dto: UpdateAgencyDto): Promise<Agency> {
    return this.prisma.agency.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined
          ? { phone: dto.phone ? dto.phone.trim() : null }
          : {}),
        ...(dto.email !== undefined
          ? { email: dto.email ? dto.email.trim().toLowerCase() : null }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.address !== undefined
          ? { address: dto.address ? dto.address.trim() : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async softDelete(id: string): Promise<Agency> {
    return this.prisma.agency.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async countActive(): Promise<number> {
    return this.prisma.agency.count({
      where: { isActive: true, deletedAt: null },
    });
  }
}
