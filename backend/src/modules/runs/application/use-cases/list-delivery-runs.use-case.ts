import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { DeliveryRunQueryDto } from "../../dto/delivery-run-query.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ListDeliveryRunsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: Partial<DeliveryRunQueryDto>, user: AuthenticatedUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.DeliveryRunWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.shift ? { shift: query.shift } : {}),
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
      ...(query.runDate
        ? {
            runDate: {
              gte: new Date(query.runDate),
              lt: new Date(new Date(query.runDate).getTime() + 86400000),
            },
          }
        : {}),
    };

    // Strict security isolation: courier sees ONLY their runs
    if (user.role === "COURIER") {
      where.courier = { userId: user.id };
    } else if (!user.isGlobalScope && user.agencyId) {
      where.agencyId = user.agencyId;
    } else if (query.agencyId) {
      where.agencyId = query.agencyId;
    }

    const [total, data] = await Promise.all([
      this.prisma.deliveryRun.count({ where }),
      this.prisma.deliveryRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ runDate: "desc" }, { createdAt: "desc" }],
        include: {
          agency: { select: { id: true, code: true, name: true } },
          zone: { select: { id: true, code: true, name: true } },
          courier: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
          runItems: {
            include: {
              parcel: {
                include: { shipment: true },
              },
            },
            orderBy: { sequenceOrder: "asc" },
          },
        } as any,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedData = data.map((run: any) => ({
      ...run,
      runNumber: run.number || run.runNumber,
      items: run.runItems || run.items || [],
    }));

    return {
      data: formattedData,
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
