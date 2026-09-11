import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { Prisma, IncidentStatus, IncidentType } from "@prisma/client";

@Injectable()
export class ListIncidentsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: {
      status?: IncidentStatus;
      type?: IncidentType;
      search?: string;
      isDeliveredDispute?: boolean;
      page?: number;
      limit?: number;
    },
    user: AuthenticatedUser,
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.IncidentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
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

    // Role security scoping
    if (user.role === "CUSTOMER" || user.role === "COURIER") {
      where.createdByUserId = user.id;
    } else if (!user.isGlobalScope && user.agencyId) {
      where.OR = [
        { agencyId: user.agencyId },
        {
          shipment: {
            OR: [
              { originAgencyId: user.agencyId },
              { destinationAgencyId: user.agencyId },
            ],
          },
        },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        include: {
          shipment: {
            select: {
              id: true,
              trackingNumber: true,
              recipientName: true,
              recipientAddress: true,
              originAgency: { select: { code: true, name: true } },
              destinationAgency: { select: { code: true, name: true } },
            },
          },
          parcel: {
            select: {
              id: true,
              trackingNumber: true,
              weightKg: true,
              status: true,
            },
          },
          createdByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          agency: {
            select: { id: true, code: true, name: true },
          },
          history: {
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
    ]);

    const data: any[] = (records as any[]).map((r) => ({
      ...r,
      incidentNumber: r.number || r.incidentNumber,
      declaredByUser: r.createdByUser || r.declaredByUser,
      history: r.history?.map((h: any) => ({
        ...h,
        performedBy: h.user || h.performedBy,
      })),
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

  async getById(id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] } as any,
      include: {
        shipment: {
          include: { originAgency: true, destinationAgency: true },
        },
        parcel: true,
        createdByUser: true,
        agency: true,
        history: {
          orderBy: { createdAt: "desc" },
          include: { user: true },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException("Dossier d'incident introuvable.");
    }

    return {
      ...incident,
      incidentNumber: (incident as any).number || (incident as any).incidentNumber,
      declaredByUser: (incident as any).createdByUser,
      history: incident.history?.map((h: any) => ({
        ...h,
        performedBy: h.user,
      })),
    };
  }
}

