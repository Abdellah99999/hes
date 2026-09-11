import { Prisma, ShipmentStatus } from "@prisma/client";
import { AuthenticatedUser } from "../../auth/domain/auth.types";
import { DateRange, ReportFilters, ReportPeriod } from "../domain/report.types";

export function resolveDateRange(
  period?: ReportPeriod,
  dateFrom?: string,
  dateTo?: string,
): DateRange {
  const now = new Date();

  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return {
      from,
      to,
      label: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
    };
  }

  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  let from: Date;

  switch (period ?? "month") {
    case "day":
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "Aujourd'hui" };
    case "week": {
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "7 derniers jours" };
    }
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: `Année ${now.getFullYear()}` };
    case "month":
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "Mois en cours" };
  }
}

function agencyScope(
  user: AuthenticatedUser,
  agencyId?: string,
): string | undefined {
  if (user.role === "CUSTOMER" || user.role === "COURIER") {
    return undefined;
  }
  if (!user.isGlobalScope && user.agencyId) {
    return user.agencyId;
  }
  return agencyId;
}

export function buildShipmentWhere(
  user: AuthenticatedUser,
  filters: ReportFilters,
  dateRange: DateRange,
): Prisma.ShipmentWhereInput {
  const where: Prisma.ShipmentWhereInput = {
    deletedAt: null,
    createdAt: { gte: dateRange.from, lte: dateRange.to },
  };

  if (filters.status) {
    where.globalStatus = filters.status as ShipmentStatus;
  }

  if (user.role === "CUSTOMER") {
    where.senderCustomerId = user.customerId ?? "__NONE__";
  } else if (user.role === "COURIER") {
    where.parcels = {
      some: {
        deliveryRunItems: {
          some: {
            deliveryRun: {
              courier: { userId: user.id },
            },
          },
        },
      },
    };
  } else {
    const scopedAgency = agencyScope(user, filters.agencyId);
    if (scopedAgency) {
      where.OR = [
        { originAgencyId: scopedAgency },
        { destinationAgencyId: scopedAgency },
      ];
    }
  }

  if (filters.customerId && user.role !== "CUSTOMER") {
    where.senderCustomerId = filters.customerId;
  }

  if (filters.courierId && user.role !== "COURIER") {
    where.parcels = {
      some: {
        deliveryRunItems: {
          some: {
            deliveryRun: {
              courier: { userId: filters.courierId },
            },
          },
        },
      },
    };
  }

  return where;
}

export function buildCollectionWhere(
  user: AuthenticatedUser,
  filters: ReportFilters,
  dateRange: DateRange,
): Prisma.CollectionWhereInput {
  const where: Prisma.CollectionWhereInput = {
    deletedAt: null,
    scheduledDate: { gte: dateRange.from, lte: dateRange.to },
  };

  if (user.role === "CUSTOMER") {
    where.customerId = user.customerId ?? "__NONE__";
  } else if (user.role === "COURIER") {
    where.assignedCourierId = user.id;
  } else {
    const scopedAgency = agencyScope(user, filters.agencyId);
    if (scopedAgency) {
      where.agencyId = scopedAgency;
    }
  }

  if (filters.customerId && user.role !== "CUSTOMER") {
    where.customerId = filters.customerId;
  }

  if (filters.courierId && user.role !== "COURIER") {
    where.assignedCourierId = filters.courierId;
  }

  return where;
}

export function buildIncidentWhere(
  user: AuthenticatedUser,
  filters: ReportFilters,
  dateRange: DateRange,
): Prisma.IncidentWhereInput {
  const where: Prisma.IncidentWhereInput = {
    createdAt: { gte: dateRange.from, lte: dateRange.to },
  };

  if (user.role === "CUSTOMER") {
    where.shipment = { senderCustomerId: user.customerId ?? "__NONE__" };
  } else if (user.role === "COURIER") {
    where.createdByUserId = user.id;
  } else {
    const scopedAgency = agencyScope(user, filters.agencyId);
    if (scopedAgency) {
      where.shipment = {
        OR: [
          { originAgencyId: scopedAgency },
          { destinationAgencyId: scopedAgency },
        ],
      };
    }
  }

  if (filters.customerId && user.role !== "CUSTOMER") {
    const existingShipmentWhere =
      where.shipment && typeof where.shipment === "object"
        ? (where.shipment as Prisma.ShipmentWhereInput)
        : {};

    where.shipment = {
      ...existingShipmentWhere,
      senderCustomerId: filters.customerId,
    };
  }

  return where;
}

export function buildInvoiceWhere(
  user: AuthenticatedUser,
  filters: ReportFilters,
  dateRange: DateRange,
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {
    issueDate: { gte: dateRange.from, lte: dateRange.to },
  };

  if (user.role === "CUSTOMER") {
    where.customerId = user.customerId ?? "__NONE__";
  } else {
    const scopedAgency = agencyScope(user, filters.agencyId);
    if (scopedAgency) {
      where.customer = { agencyId: scopedAgency };
    }
  }

  if (filters.customerId && user.role !== "CUSTOMER") {
    where.customerId = filters.customerId;
  }

  return where;
}
