import { Injectable, BadRequestException } from "@nestjs/common";
import { RunItemStatus } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { ReportDataQueryDto } from "../../dto/report-query.dto";
import {
  buildCollectionWhere,
  buildIncidentWhere,
  buildInvoiceWhere,
  buildShipmentWhere,
  resolveDateRange,
} from "../report-scope.helper";

@Injectable()
export class GetReportDataUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ReportDataQueryDto, user: AuthenticatedUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const dateRange = resolveDateRange(
      query.period,
      query.dateFrom,
      query.dateTo,
    );
    const filters = {
      period: query.period,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      agencyId: query.agencyId,
      courierId: query.courierId,
      customerId: query.customerId,
      status: query.status,
    };

    switch (query.type) {
      case "SHIPMENTS":
        return this.fetchShipments(filters, dateRange, user, skip, limit, page);
      case "DELIVERIES":
        return this.fetchDeliveries(
          filters,
          dateRange,
          user,
          skip,
          limit,
          page,
        );
      case "COLLECTIONS":
        return this.fetchCollections(
          filters,
          dateRange,
          user,
          skip,
          limit,
          page,
        );
      case "INCIDENTS":
        return this.fetchIncidents(filters, dateRange, user, skip, limit, page);
      case "REVENUE":
        return this.fetchRevenue(filters, dateRange, user, skip, limit, page);
      default:
        throw new BadRequestException("Type de rapport non supporté.");
    }
  }

  private paginate<T>(data: T[], total: number, page: number, limit: number) {
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

  private async fetchShipments(
    filters: Parameters<typeof buildShipmentWhere>[1],
    dateRange: ReturnType<typeof resolveDateRange>,
    user: AuthenticatedUser,
    skip: number,
    limit: number,
    page: number,
  ) {
    const where = buildShipmentWhere(user, filters, dateRange);
    const [total, data] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          trackingNumber: true,
          globalStatus: true,
          recipientName: true,
          recipientAddress: true,
          shippingFee: true,
          createdAt: true,
          originAgency: { select: { code: true, name: true } },
          destinationAgency: { select: { code: true, name: true } },
          senderCustomer: { select: { code: true, legalName: true } },
          destinationAddress: { select: { city: true } },
        },
      }),
    ]);
    const mapped = data.map((s: any) => ({
      ...s,
      trackingNumber: s.trackingNumber || s.number,
      recipientCity:
        s.destinationAddress?.city ||
        s.recipientAddress?.split(",")?.pop()?.trim() ||
        "N/A",
    }));
    return this.paginate(mapped, total, page, limit);
  }

  private async fetchDeliveries(
    filters: Parameters<typeof buildShipmentWhere>[1],
    dateRange: ReturnType<typeof resolveDateRange>,
    user: AuthenticatedUser,
    skip: number,
    limit: number,
    page: number,
  ) {
    const shipmentWhere = buildShipmentWhere(user, filters, dateRange);
    const where = {
      status: {
        in: [RunItemStatus.COMPLETED, RunItemStatus.FAILED],
      },
      deliveryRun: {
        runDate: { gte: dateRange.from, lte: dateRange.to },
        ...(filters.agencyId && user.isGlobalScope
          ? { agencyId: filters.agencyId }
          : !user.isGlobalScope &&
              user.agencyId &&
              user.role !== "CUSTOMER" &&
              user.role !== "COURIER"
            ? { agencyId: user.agencyId }
            : {}),
        ...(filters.courierId
          ? { courier: { userId: filters.courierId } }
          : user.role === "COURIER"
            ? { courier: { userId: user.id } }
            : {}),
      },
      parcel: { shipment: shipmentWhere },
    };

    const [total, data] = await Promise.all([
      this.prisma.deliveryRunItem.count({ where }),
      this.prisma.deliveryRunItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          deliveredAt: true,
          updatedAt: true,
          parcel: {
            select: {
              number: true,
              trackingNumber: true,
              shipment: {
                select: {
                  number: true,
                  trackingNumber: true,
                  recipientName: true,
                  recipientAddress: true,
                  destinationAddress: {
                    select: { city: true },
                  },
                },
              },
            },
          },
          deliveryRun: {
            select: {
              number: true,
              runDate: true,
              courier: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    const mapped = data.map((item: any) => ({
      ...item,
      failedAt: item.status === RunItemStatus.FAILED ? item.updatedAt : null,
      deliveryRun: {
        ...item.deliveryRun,
        runNumber: item.deliveryRun?.number,
      },
      parcel: {
        ...item.parcel,
        trackingNumber: item.parcel?.trackingNumber || item.parcel?.number,
        shipment: {
          ...item.parcel?.shipment,
          trackingNumber:
            item.parcel?.shipment?.trackingNumber || item.parcel?.shipment?.number,
          recipientCity:
            item.parcel?.shipment?.destinationAddress?.city ||
            item.parcel?.shipment?.recipientAddress?.split(",")?.pop()?.trim() ||
            "N/A",
        },
      },
    }));
    return this.paginate(mapped, total, page, limit);
  }

  private async fetchCollections(
    filters: Parameters<typeof buildCollectionWhere>[1],
    dateRange: ReturnType<typeof resolveDateRange>,
    user: AuthenticatedUser,
    skip: number,
    limit: number,
    page: number,
  ) {
    const where = buildCollectionWhere(user, filters, dateRange);
    const [total, data] = await Promise.all([
      this.prisma.collection.count({ where }),
      this.prisma.collection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: "desc" },
        select: {
          id: true,
          number: true,
          collectionNumber: true,
          status: true,
          scheduledDate: true,
          pickupCity: true,
          customer: { select: { code: true, legalName: true } },
          agency: { select: { code: true, name: true } },
          assignedCourier: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
    ]);
    const mapped = data.map((c: any) => ({
      ...c,
      collectionNumber: c.collectionNumber || c.number,
    }));
    return this.paginate(mapped, total, page, limit);
  }

  private async fetchIncidents(
    filters: Parameters<typeof buildIncidentWhere>[1],
    dateRange: ReturnType<typeof resolveDateRange>,
    user: AuthenticatedUser,
    skip: number,
    limit: number,
    page: number,
  ) {
    const where = buildIncidentWhere(user, filters, dateRange);
    const [total, data] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          type: true,
          severity: true,
          status: true,
          createdAt: true,
          shipment: {
            select: {
              number: true,
              trackingNumber: true,
              originAgency: { select: { code: true } },
            },
          },
        },
      }),
    ]);
    const mapped = data.map((inc: any) => ({
      ...inc,
      incidentNumber: inc.number,
      shipment: inc.shipment
        ? {
            ...inc.shipment,
            trackingNumber: inc.shipment.trackingNumber || inc.shipment.number,
          }
        : null,
    }));
    return this.paginate(mapped, total, page, limit);
  }

  private async fetchRevenue(
    filters: Parameters<typeof buildInvoiceWhere>[1],
    dateRange: ReturnType<typeof resolveDateRange>,
    user: AuthenticatedUser,
    skip: number,
    limit: number,
    page: number,
  ) {
    const where = buildInvoiceWhere(user, filters, dateRange);
    const [total, data] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          number: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          totalAmount: true,
          paidAmount: true,
          customer: { select: { code: true, legalName: true } },
        },
      }),
    ]);
    const mapped = data.map((inv: any) => ({
      ...inv,
      invoiceNumber: inv.invoiceNumber || inv.number,
      remainingAmount: Number(inv.totalAmount) - Number(inv.paidAmount),
    }));
    return this.paginate(mapped, total, page, limit);
  }
}
