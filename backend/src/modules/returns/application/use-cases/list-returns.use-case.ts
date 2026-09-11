import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { Prisma, ReturnStatus } from "@prisma/client";

@Injectable()
export class ListReturnsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: {
      status?: ReturnStatus;
      originAgencyId?: string;
      destinationAgencyId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user: AuthenticatedUser,
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ReturnWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    if (query.search) {
      where.OR = [
        { number: { contains: query.search, mode: "insensitive" } },
        {
          shipment: {
            trackingNumber: { contains: query.search, mode: "insensitive" },
          },
        },
      ];
    }

    // Role and agency scoping
    if (user.role === "COURIER") {
      where.handledByUserId = user.id;
    } else if (!user.isGlobalScope && user.agencyId) {
      where.OR = [
        { originAgencyId: user.agencyId },
        { destinationAgencyId: user.agencyId },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.return.count({ where }),
      this.prisma.return.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          shipment: {
            select: {
              id: true,
              trackingNumber: true,
              recipientName: true,
              recipientAddress: true,
              senderCustomer: { select: { id: true, legalName: true } },
            },
          },
          originAgency: { select: { id: true, code: true, name: true } },
          destinationAgency: { select: { id: true, code: true, name: true } },
          handledByUser: {
            select: { id: true, firstName: true, lastName: true },
          },
          items: {
            include: {
              parcel: {
                select: {
                  id: true,
                  trackingNumber: true,
                  weightKg: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const data: any[] = (records as any[]).map((r) => ({
      ...r,
      returnNumber: (r as any).number || (r as any).returnNumber,
      assignedCourier: (r as any).handledByUser || (r as any).assignedCourier,
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
}

