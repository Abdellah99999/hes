import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { CollectionQueryDto } from "../../dto/collection-query.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ListCollectionsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: Partial<CollectionQueryDto>, user: AuthenticatedUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CollectionWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
      ...(query.scheduledDate
        ? {
            scheduledDate: {
              gte: new Date(query.scheduledDate),
              lt: new Date(new Date(query.scheduledDate).getTime() + 86400000),
            },
          }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                collectionNumber: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                pickupContactName: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                pickupPhone: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                pickupCity: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    // Strict Security & Role Scoping
    if (user.role === "CUSTOMER") {
      // Customer can ONLY see their own collections
      where.customerId = user.customerId ?? "__NONE__";
    } else if (user.role === "COURIER") {
      // Courier can ONLY see missions assigned to them
      where.assignedCourierId = user.id;
    } else if (!user.isGlobalScope && user.agencyId) {
      // Local agency dispatcher can only see their agency's collections
      where.agencyId = user.agencyId;
    } else if (query.agencyId) {
      where.agencyId = query.agencyId;
    }

    const [total, data] = await Promise.all([
      this.prisma.collection.count({ where }),
      this.prisma.collection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: "desc" },
        include: {
          customer: {
            select: { id: true, legalName: true, code: true, phone: true },
          },
          agency: {
            select: { id: true, code: true, name: true },
          },
          zone: {
            select: { id: true, code: true, name: true },
          },
          assignedCourier: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          items: true,
          shipment: {
            select: { id: true, trackingNumber: true, globalStatus: true },
          },
        },
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
}
