import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Address, AuditEventType } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../auth/services/audit.service";
import {
  IAddressRepository,
  AddressWithRelations,
} from "../domain/address.repository.interface";
import { CreateAddressDto } from "../dto/create-address.dto";
import { UpdateAddressDto } from "../dto/update-address.dto";
import { AddressQueryDto } from "../dto/address-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

@Injectable()
export class PrismaAddressRepository implements IAddressRepository {
  private readonly defaultInclude = {
    agency: true,
    customer: true,
    zone: true,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async verifyAddressAgencyAccess(
    addressId: string,
    action: string,
    user: AuthenticatedUser,
  ): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, deletedAt: null },
    });

    if (!address) {
      throw new NotFoundException("Adresse introuvable.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      address.agencyId !== user.agencyId
    ) {
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action,
          targetResourceId: addressId,
          targetAgencyId: address.agencyId,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : l'adresse n'appartient pas à votre agence.",
      );
    }

    return address;
  }

  async create(
    dto: CreateAddressDto,
    agencyId: string,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations> {
    const targetAgencyId = user.isGlobalScope
      ? dto.agencyId || agencyId
      : agencyId;

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException("Client rattaché introuvable.");
      }
      if (
        !user.isGlobalScope &&
        user.agencyId &&
        customer.agencyId !== user.agencyId
      ) {
        throw new ForbiddenException(
          "Impossible de rattacher une adresse à un client d'une autre agence.",
        );
      }
    }

    if (dto.isDefault && dto.customerId) {
      await this.prisma.address.updateMany({
        where: { customerId: dto.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        agencyId: targetAgencyId,
        customerId: dto.customerId ?? null,
        zoneId: dto.zoneId ?? null,
        type: dto.type,
        title: dto.title.trim(),
        street: dto.street.trim(),
        additionalInfo: dto.additionalInfo?.trim() ?? null,
        city: dto.city.trim(),
        postalCode: dto.postalCode?.trim() ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isDefault: dto.isDefault ?? false,
      },
      include: this.defaultInclude,
    });
  }

  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations | null> {
    await this.verifyAddressAgencyAccess(id, "ADDRESS_READ_ATTEMPT", user);

    return this.prisma.address.findUnique({
      where: { id },
      include: this.defaultInclude,
    });
  }

  async findAll(
    query: AddressQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<AddressWithRelations>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const effectiveAgencyId = user.isGlobalScope
      ? query.agencyId
      : user.agencyId;

    const where: Prisma.AddressWhereInput = {
      deletedAt: null,
      ...(effectiveAgencyId ? { agencyId: effectiveAgencyId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.city
        ? { city: { contains: query.city, mode: "insensitive" } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { street: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
              { postalCode: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.address.count({ where }),
      this.prisma.address.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: this.defaultInclude,
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
    dto: UpdateAddressDto,
    user: AuthenticatedUser,
  ): Promise<AddressWithRelations> {
    const address = await this.verifyAddressAgencyAccess(
      id,
      "ADDRESS_WRITE_ATTEMPT",
      user,
    );

    if (dto.isDefault && address.customerId) {
      await this.prisma.address.updateMany({
        where: { customerId: address.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id },
      data: {
        ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.street !== undefined ? { street: dto.street.trim() } : {}),
        ...(dto.additionalInfo !== undefined
          ? {
              additionalInfo: dto.additionalInfo
                ? dto.additionalInfo.trim()
                : null,
            }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.postalCode !== undefined
          ? { postalCode: dto.postalCode ? dto.postalCode.trim() : null }
          : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
      include: this.defaultInclude,
    });
  }

  async softDelete(id: string, user: AuthenticatedUser): Promise<Address> {
    await this.verifyAddressAgencyAccess(id, "ADDRESS_DELETE_ATTEMPT", user);

    return this.prisma.address.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isDefault: false,
      },
    });
  }
}
