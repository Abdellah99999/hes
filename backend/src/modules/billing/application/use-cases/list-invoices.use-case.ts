import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { Prisma, InvoiceStatus } from "@prisma/client";

@Injectable()
export class ListInvoicesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: {
      customerId?: string;
      status?: InvoiceStatus;
      search?: string;
      page?: number;
      limit?: number;
    },
    user: AuthenticatedUser,
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };

    if (query.search) {
      where.OR = [
        { number: { contains: query.search, mode: "insensitive" } },
        { invoiceNumber: { contains: query.search, mode: "insensitive" } },
        {
          customer: {
            legalName: { contains: query.search, mode: "insensitive" },
          },
        },
        { customer: { code: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    // Role-based security scoping
    if (user.role === "CUSTOMER") {
      if (user.customerId) {
        where.customerId = user.customerId;
      } else {
        where.customer = { users: { some: { id: user.id } } };
      }
    } else if (!user.isGlobalScope && user.agencyId) {
      where.customer = { agencyId: user.agencyId };
    }

    const [total, records] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ issueDate: "desc" }],
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              legalName: true,
              ice: true,
              email: true,
            },
          },
          items: true,
        },
      }),
    ]);

    const data: any[] = (records as any[]).map((inv) => ({
      ...inv,
      invoiceNumber: inv.number || inv.invoiceNumber,
      subtotalAmount: Number(inv.subtotal),
      taxAmount: Number(inv.taxAmount),
      totalAmount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      remainingAmount: Math.max(
        0,
        Number(inv.totalAmount) - Number(inv.paidAmount),
      ),
    }));

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

  async getById(id: string, user: AuthenticatedUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { number: id }, { invoiceNumber: id }],
      } as any,
      include: {
        customer: true,
        items: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException("Facture introuvable.");
    }

    // Security check for customer
    if (
      user.role === "CUSTOMER" &&
      user.customerId &&
      invoice.customerId !== user.customerId
    ) {
      throw new NotFoundException("Facture introuvable.");
    }

    return {
      ...invoice,
      invoiceNumber: (invoice as any).number || (invoice as any).invoiceNumber,
      subtotalAmount: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      remainingAmount: Math.max(
        0,
        Number(invoice.totalAmount) - Number(invoice.paidAmount),
      ),
    };
  }
}

