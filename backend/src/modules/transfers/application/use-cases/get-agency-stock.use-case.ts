import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { AgencyStockQueryDto } from "../../dto/agency-stock-query.dto";
import { Prisma } from "@prisma/client";

export interface AgencyStockSummary {
  agency: { id: string; code: string; name: string };
  totalParcels: number;
  totalWeightKg: number;
  totalVolumetricWeightKg: number;
  statusBreakdown: Record<string, number>;
  retentionAlertCount: number; // Parcels stored >= 3 days
}

@Injectable()
export class GetAgencyStockUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    agencyId: string,
    query: Partial<AgencyStockQueryDto>,
    user: AuthenticatedUser,
  ) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, code: true, name: true },
    });

    if (!agency) {
      throw new NotFoundException("Agence introuvable.");
    }

    if (!user.isGlobalScope && user.agencyId && user.agencyId !== agencyId) {
      throw new ForbiddenException(
        "Accès refusé : vous ne pouvez consulter que le stock quai de votre propre agence.",
      );
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    // Filter condition leveraging index (currentAgencyId, status)
    const where: Prisma.ParcelWhereInput = {
      currentAgencyId: agencyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                trackingNumber: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                barcode: { contains: query.search.trim(), mode: "insensitive" },
              },
              {
                shipment: {
                  OR: [
                    {
                      recipientName: {
                        contains: query.search.trim(),
                        mode: "insensitive",
                      },
                    },
                    {
                      recipientAddress: {
                        contains: query.search.trim(),
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    // Parallel execution for high throughput
    const [total, rawParcels, aggregations, allStatusCounts] =
      await Promise.all([
        this.prisma.parcel.count({ where }),
        this.prisma.parcel.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "asc" }, // Oldest first to prioritize oldest stock
          include: {
            parcelType: true,
            shipment: {
              select: {
                id: true,
                trackingNumber: true,
                recipientName: true,
                recipientAddress: true,
                service: { select: { code: true, name: true } },
                destinationAddress: { select: { city: true } },
                originAgency: { select: { code: true } },
                destinationAgency: { select: { code: true } },
              },
            },
          },
        }),
        this.prisma.parcel.aggregate({
          where: { currentAgencyId: agencyId, deletedAt: null },
          _sum: {
            weightKg: true,
            volumetricWeightKg: true,
          },
        }),
        this.prisma.parcel.groupBy({
          by: ["status"],
          where: { currentAgencyId: agencyId, deletedAt: null },
          _count: { id: true },
        }),
      ]);

    const now = Date.now();
    let retentionAlertCount = 0;

    const parcels = rawParcels.map((p) => {
      const daysInStock = Math.floor(
        (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysInStock >= 3) {
        retentionAlertCount++;
      }

      return {
        id: p.id,
        trackingNumber: p.trackingNumber,
        barcode: p.barcode,
        parcelIndex: p.parcelIndex,
        weightKg: p.weightKg,
        volumetricWeightKg: p.volumetricWeightKg,
        status: p.status,
        parcelType: p.parcelType,
        shipment: p.shipment
          ? {
              id: p.shipment.id,
              trackingNumber: p.shipment.trackingNumber,
              recipientName: p.shipment.recipientName,
              recipientCity: p.shipment.destinationAddress?.city || "",
              serviceType: p.shipment.service?.code || "STANDARD",
              originAgency: p.shipment.originAgency,
              destinationAgency: p.shipment.destinationAgency,
            }
          : null,
        createdAt: p.createdAt,
        daysInStock,
      };
    });

    const statusBreakdown: Record<string, number> = {};
    for (const group of allStatusCounts) {
      statusBreakdown[group.status] = group._count.id;
    }

    const totalPages = Math.ceil(total / limit);

    return {
      summary: {
        agency,
        totalParcels: total,
        totalWeightKg: aggregations._sum.weightKg
          ? Number(aggregations._sum.weightKg)
          : 0,
        totalVolumetricWeightKg: aggregations._sum.volumetricWeightKg
          ? Number(aggregations._sum.volumetricWeightKg)
          : 0,
        statusBreakdown,
        retentionAlertCount,
      },
      data: parcels,
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
