import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { CustomerContact, AuditEventType } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../auth/services/audit.service";
import { ICustomerContactRepository } from "../domain/customer-contact.repository.interface";
import { CreateCustomerContactDto } from "../dto/create-customer-contact.dto";
import { UpdateCustomerContactDto } from "../dto/update-customer-contact.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";

@Injectable()
export class PrismaCustomerContactRepository implements ICustomerContactRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async verifyContactAgencyAccess(
    contactId: string,
    action: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact> {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, deletedAt: null },
      include: { customer: true },
    });

    if (!contact) {
      throw new NotFoundException("Contact introuvable.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      contact.customer.agencyId !== user.agencyId
    ) {
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action,
          targetResourceId: contactId,
          targetAgencyId: contact.customer.agencyId,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : le contact n'appartient pas à votre agence.",
      );
    }

    return contact;
  }

  async create(
    dto: CreateCustomerContactDto,
    agencyId: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact> {
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
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action: "CONTACT_CREATE_ATTEMPT",
          targetResourceId: dto.customerId,
          targetAgencyId: customer.agencyId,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : le client n'appartient pas à votre agence.",
      );
    }

    return this.prisma.customerContact.create({
      data: {
        customerId: dto.customerId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email?.trim().toLowerCase() ?? null,
        phone: dto.phone?.trim() ?? null,
        role: dto.roleTitle?.trim() ?? null,
        isPrimary: dto.isPrimary ?? false,
      },
    });
  }

  async findByCustomerId(
    customerId: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact[]> {
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
          action: "CUSTOMER_CONTACTS_LIST_ATTEMPT",
          targetResourceId: customerId,
          targetAgencyId: customer.agencyId,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : le client n'appartient pas à votre agence.",
      );
    }

    return this.prisma.customerContact.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
    });
  }

  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact | null> {
    return this.verifyContactAgencyAccess(id, "CONTACT_READ_ATTEMPT", user);
  }

  async update(
    id: string,
    dto: UpdateCustomerContactDto,
    user: AuthenticatedUser,
  ): Promise<CustomerContact> {
    await this.verifyContactAgencyAccess(id, "CONTACT_WRITE_ATTEMPT", user);

    return this.prisma.customerContact.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined
          ? { firstName: dto.firstName.trim() }
          : {}),
        ...(dto.lastName !== undefined
          ? { lastName: dto.lastName.trim() }
          : {}),
        ...(dto.email !== undefined
          ? { email: dto.email ? dto.email.trim().toLowerCase() : null }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: dto.phone ? dto.phone.trim() : null }
          : {}),
        ...(dto.roleTitle !== undefined
          ? { role: dto.roleTitle ? dto.roleTitle.trim() : null }
          : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
      },
    });
  }

  async softDelete(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CustomerContact> {
    await this.verifyContactAgencyAccess(id, "CONTACT_DELETE_ATTEMPT", user);

    return this.prisma.customerContact.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
