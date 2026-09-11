import { Injectable } from "@nestjs/common";
import { IncidentStatus } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { DashboardQueryDto } from "../../dto/dashboard-query.dto";
import {
  buildCollectionWhere,
  buildIncidentWhere,
  buildShipmentWhere,
  resolveDateRange,
} from "../report-scope.helper";
import { DashboardSummary } from "../../domain/report.types";

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: DashboardQueryDto,
    user: AuthenticatedUser,
  ): Promise<DashboardSummary> {
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

    const shipmentWhere = buildShipmentWhere(user, filters, dateRange);
    const collectionWhere = buildCollectionWhere(user, filters, dateRange);
    const incidentWhere = buildIncidentWhere(user, filters, dateRange);

    const [
      totalShipments,
      delivered,
      inTransit,
      outForDelivery,
      pending,
      cancelled,
      returned,
      statusGroups,
      revenueAgg,
      collectionsTotal,
      collectionsCompleted,
      openIncidents,
    ] = await Promise.all([
      this.prisma.shipment.count({ where: shipmentWhere }),
      this.prisma.shipment.count({
        where: { ...shipmentWhere, globalStatus: "DELIVERED" },
      }),
      this.prisma.shipment.count({
        where: { ...shipmentWhere, globalStatus: "IN_TRANSIT" },
      }),
      this.prisma.shipment.count({
        where: { ...shipmentWhere, globalStatus: "OUT_FOR_DELIVERY" },
      }),
      this.prisma.shipment.count({
        where: {
          ...shipmentWhere,
          globalStatus: { in: ["REGISTERED", "DRAFT"] },
        },
      }),
      this.prisma.shipment.count({
        where: { ...shipmentWhere, globalStatus: "CANCELLED" },
      }),
      this.prisma.shipment.count({
        where: { ...shipmentWhere, globalStatus: "RETURNED" },
      }),
      this.prisma.shipment.groupBy({
        by: ["globalStatus"],
        where: shipmentWhere,
        _count: { id: true },
      }),
      this.prisma.shipment.aggregate({
        where: shipmentWhere,
        _sum: { shippingFee: true },
      }),
      this.prisma.collection.count({ where: collectionWhere }),
      this.prisma.collection.count({
        where: { ...collectionWhere, status: "COMPLETED" },
      }),
      this.prisma.incident.count({
        where: {
          ...incidentWhere,
          status: {
            in: [IncidentStatus.REPORTED, IncidentStatus.INVESTIGATING],
          },
        },
      }),
    ]);

    const terminalCount = delivered + returned + cancelled;
    const deliverySuccessRate =
      terminalCount > 0
        ? Math.round((delivered / terminalCount) * 10000) / 100
        : 0;

    return {
      period: dateRange,
      filters,
      kpis: {
        totalShipments,
        delivered,
        inTransit,
        outForDelivery,
        pending,
        cancelled,
        returned,
        collectionsTotal,
        collectionsCompleted,
        openIncidents,
        deliverySuccessRate,
        totalRevenue: Number(revenueAgg._sum.shippingFee ?? 0),
      },
      statusBreakdown: statusGroups.map(
        (g: { globalStatus: string | null; _count: { id: number } }) => ({
          status: g.globalStatus ?? "UNKNOWN",
          count: g._count.id,
        }),
      ),
    };
  }
}
