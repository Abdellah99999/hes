import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AgencyStatus, Prisma, Zone } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../auth/services/audit.service";
import { IZoneRepository } from "../domain/zone.repository.interface";
import { CreateZoneDto } from "../dto/create-zone.dto";
import { UpdateZoneDto } from "../dto/update-zone.dto";
import { ZoneQueryDto } from "../dto/zone-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

@Injectable()
export class PrismaZoneRepository implements IZoneRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateZoneDto, agencyId: string): Promise<Zone> {
    return this.prisma.zone.create({
      data: {
        agencyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        status: AgencyStatus.ACTIVE,
      },
    });
  }

  async findById(id: string, user: AuthenticatedUser): Promise<Zone | null> {
    const zone = await this.prisma.zone.findFirst({
      where: { id, deletedAt: null },
    });

    if (!zone) {
      return null;
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      zone.agencyId !== user.agencyId
    ) {
      await this.auditService.logEvent({
        eventType: "SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT",
        userId: user.id,
        identifier: user.email,
        metadata: {
          action: "ZONE_READ_ATTEMPT",
          targetResourceId: id,
          targetAgencyId: zone.agencyId,
          userAgencyId: user.agencyId,
        },
      });
      throw new ForbiddenException(
        "Accès refusé : la zone demandée n'appartient pas à votre agence.",
      );
    }

    return zone;
  }

  async findByCodeInAgency(
    agencyId: string,
    code: string,
  ): Promise<Zone | null> {
    return this.prisma.zone.findFirst({
      where: {
        agencyId,
        code: code.trim().toUpperCase(),
        deletedAt: null,
      },
    });
  }

  async findAll(
    query: ZoneQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<Zone>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const effectiveAgencyId = user.isGlobalScope
      ? query.agencyId
      : user.agencyId;

    const where: Prisma.ZoneWhereInput = {
      deletedAt: null,
      ...(effectiveAgencyId ? { agencyId: effectiveAgencyId } : {}),
      ...(query.isActive !== undefined
        ? {
            status: query.isActive
              ? AgencyStatus.ACTIVE
              : AgencyStatus.INACTIVE,
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.zone.count({ where }),
      this.prisma.zone.findMany({
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

  async update(
    id: string,
    dto: UpdateZoneDto,
    user: AuthenticatedUser,
  ): Promise<Zone> {
    const existing = await this.findById(id, user);
    if (!existing) {
      throw new NotFoundException("Zone introuvable.");
    }

    return this.prisma.zone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ? dto.description.trim() : null }
          : {}),
        ...(dto.isActive !== undefined
          ? {
              status: dto.isActive
                ? AgencyStatus.ACTIVE
                : AgencyStatus.INACTIVE,
            }
          : {}),
      },
    });
  }

  async softDelete(id: string, user: AuthenticatedUser): Promise<Zone> {
    const existing = await this.findById(id, user);
    if (!existing) {
      throw new NotFoundException("Zone introuvable.");
    }

    return this.prisma.zone.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: AgencyStatus.INACTIVE,
      },
    });
  }
}
