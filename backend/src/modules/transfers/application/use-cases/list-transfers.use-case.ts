import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { TransferQueryDto } from "../../dto/transfer-query.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ListTransfersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: TransferQueryDto, user: AuthenticatedUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TransferWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.originAgencyId ? { originAgencyId: query.originAgencyId } : {}),
      ...(query.destinationAgencyId
        ? { destinationAgencyId: query.destinationAgencyId }
        : {}),
      ...(!user.isGlobalScope && user.agencyId
        ? {
            OR: [
              { originAgencyId: user.agencyId },
              { destinationAgencyId: user.agencyId },
            ],
          }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                number: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                transferNumber: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                vehiclePlate: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                driverName: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.transfer.count({ where }),
      this.prisma.transfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          originAgency: { select: { id: true, code: true, name: true } },
          destinationAgency: { select: { id: true, code: true, name: true } },
          createdByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          receivedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
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
