import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  Customer,
  AuditEventType,
  CustomerStatus,
} from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../auth/services/audit.service";
import {
  ICustomerRepository,
  CustomerWithRelations,
  ManagerAssignmentWithUsers,
} from "../domain/customer.repository.interface";
import { CreateCustomerDto } from "../dto/create-customer.dto";
import { UpdateCustomerDto } from "../dto/update-customer.dto";
import { CustomerQueryDto } from "../dto/customer-query.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

@Injectable()
export class PrismaCustomerRepository implements ICustomerRepository {
  private readonly defaultInclude = {
    agency: true,
    customerType: true,
    managerAssignments: {
      where: { isCurrent: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    },
    contacts: {
      where: { deletedAt: null },
      orderBy: { isPrimary: "desc" as const },
    },
    addresses: {
      where: { deletedAt: null },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async verifyAgencyAccess(
    customerId: string,
    action: string,
    user: AuthenticatedUser,
  ): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException("Client introuvable.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      customer.agencyId !== user.agencyId
    ) {
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action,
          targetResourceId: customerId,
          targetAgencyId: customer.agencyId,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : la ressource demandée n'appartient pas à votre agence.",
      );
    }

    return customer;
  }

  async create(
    dto: CreateCustomerDto,
    agencyId: string,
    assignedByUserId: string,
  ): Promise<CustomerWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          agencyId,
          customerTypeId: dto.customerTypeId,
          code: dto.code.trim().toUpperCase(),
          legalName: dto.legalName.trim(),
          tradeName: dto.tradeName?.trim() ?? null,
          ice: dto.ice?.trim() ?? null,
          taxId: dto.taxId?.trim() ?? null,
          email: dto.email?.trim().toLowerCase() ?? null,
          phone: dto.phone?.trim() ?? null,
          status: dto.status ?? CustomerStatus.ACTIVE,
          notes: dto.notes?.trim() ?? null,
        },
      });

      if (dto.initialManagerUserId) {
        await tx.customerInternalManager.create({
          data: {
            customerId: customer.id,
            userId: dto.initialManagerUserId,
            agencyId,
            assignedAt: new Date(),
            isCurrent: true,
            assignmentReason:
              dto.initialManagerReason?.trim() ||
              "Attribution initiale à la création",
            assignedByUserId,
          },
        });
      }

      return tx.customer.findUniqueOrThrow({
        where: { id: customer.id },
        include: this.defaultInclude,
      });
    });
  }

  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CustomerWithRelations | null> {
    await this.verifyAgencyAccess(id, "CUSTOMER_READ_ATTEMPT", user);

    return this.prisma.customer.findUnique({
      where: { id },
      include: this.defaultInclude,
    });
  }

  async findByCode(code: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { code: code.trim().toUpperCase(), deletedAt: null },
    });
  }

  async findAll(
    query: CustomerQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<CustomerWithRelations>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const effectiveAgencyId = user.isGlobalScope
      ? query.agencyId
      : user.agencyId;

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(effectiveAgencyId ? { agencyId: effectiveAgencyId } : {}),
      ...(query.customerTypeId ? { customerTypeId: query.customerTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { legalName: { contains: query.search, mode: "insensitive" } },
              { tradeName: { contains: query.search, mode: "insensitive" } },
              { ice: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { legalName: "asc" },
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
    dto: UpdateCustomerDto,
    user: AuthenticatedUser,
  ): Promise<CustomerWithRelations> {
    await this.verifyAgencyAccess(id, "CUSTOMER_WRITE_ATTEMPT", user);

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.customerTypeId !== undefined
          ? { customerTypeId: dto.customerTypeId }
          : {}),
        ...(dto.legalName !== undefined
          ? { legalName: dto.legalName.trim() }
          : {}),
        ...(dto.tradeName !== undefined
          ? { tradeName: dto.tradeName ? dto.tradeName.trim() : null }
          : {}),
        ...(dto.ice !== undefined
          ? { ice: dto.ice ? dto.ice.trim() : null }
          : {}),
        ...(dto.taxId !== undefined
          ? { taxId: dto.taxId ? dto.taxId.trim() : null }
          : {}),
        ...(dto.email !== undefined
          ? { email: dto.email ? dto.email.trim().toLowerCase() : null }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: dto.phone ? dto.phone.trim() : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes ? dto.notes.trim() : null }
          : {}),
      },
      include: this.defaultInclude,
    });
  }

  async softDelete(id: string, user: AuthenticatedUser): Promise<Customer> {
    await this.verifyAgencyAccess(id, "CUSTOMER_DELETE_ATTEMPT", user);

    return this.prisma.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: CustomerStatus.SUSPENDED,
      },
    });
  }

  async assignManager(
    customerId: string,
    newManagerUserId: string,
    reason: string | undefined,
    assignedByUserId: string,
    user: AuthenticatedUser,
  ): Promise<ManagerAssignmentWithUsers> {
    const customer = await this.verifyAgencyAccess(
      customerId,
      "CUSTOMER_MANAGER_ASSIGN_ATTEMPT",
      user,
    );

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Clôture atomique de l'ancien gestionnaire en cours
      await tx.customerInternalManager.updateMany({
        where: {
          customerId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          unassignedAt: now,
        },
      });

      // 2. Création de la nouvelle assignation
      return tx.customerInternalManager.create({
        data: {
          customerId,
          userId: newManagerUserId,
          agencyId: customer.agencyId,
          assignedAt: now,
          isCurrent: true,
          assignmentReason: reason?.trim() || "Réassignation de compte",
          assignedByUserId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });
  }

  async getManagerHistory(
    customerId: string,
    user: AuthenticatedUser,
  ): Promise<ManagerAssignmentWithUsers[]> {
    await this.verifyAgencyAccess(
      customerId,
      "CUSTOMER_MANAGER_HISTORY_READ_ATTEMPT",
      user,
    );

    return this.prisma.customerInternalManager.findMany({
      where: { customerId },
      orderBy: { assignedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}
