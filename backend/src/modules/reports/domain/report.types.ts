import { ShipmentStatus } from "@prisma/client";

export type ReportPeriod = "day" | "week" | "month" | "year";

export type ReportType =
  "SHIPMENTS" | "DELIVERIES" | "COLLECTIONS" | "INCIDENTS" | "REVENUE";

export type ExportFormat = "pdf" | "excel";

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

export interface ReportFilters {
  period?: ReportPeriod;
  dateFrom?: string;
  dateTo?: string;
  agencyId?: string;
  courierId?: string;
  customerId?: string;
  status?: ShipmentStatus | string;
}

export interface DashboardSummary {
  period: DateRange;
  filters: ReportFilters;
  kpis: {
    totalShipments: number;
    delivered: number;
    inTransit: number;
    outForDelivery: number;
    pending: number;
    cancelled: number;
    returned: number;
    collectionsTotal: number;
    collectionsCompleted: number;
    openIncidents: number;
    deliverySuccessRate: number;
    totalRevenue: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
}

export const MAX_EXPORT_ROWS = 10_000;
