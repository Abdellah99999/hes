import { createMinimalPdf } from "../../documents/generators/pdf-builder.helper";
import { DashboardSummary, ReportType } from "../domain/report.types";

function flattenRow(row: Record<string, unknown>, type: ReportType): string {
  switch (type) {
    case "SHIPMENTS":
      return [
        String(row.trackingNumber ?? row.number ?? ""),
        String(row.globalStatus ?? ""),
        String((row.senderCustomer as { legalName?: string })?.legalName ?? ""),
        String(row.recipientName ?? ""),
        String(row.recipientCity ?? ""),
        String((row.originAgency as { code?: string })?.code ?? ""),
        String(row.shippingFee ?? ""),
        String(row.createdAt ?? ""),
      ].join(" | ");
    case "DELIVERIES": {
      const parcel = row.parcel as Record<string, unknown> | undefined;
      const run = row.deliveryRun as Record<string, unknown> | undefined;
      const courier = (run?.courier as Record<string, unknown>)?.user as
        Record<string, string> | undefined;
      return [
        String(parcel?.trackingNumber ?? parcel?.number ?? ""),
        String(row.status ?? ""),
        String(
          (parcel?.shipment as { recipientName?: string })?.recipientName ?? "",
        ),
        `${courier?.firstName ?? ""} ${courier?.lastName ?? ""}`.trim(),
        String(row.deliveredAt ?? row.failedAt ?? row.updatedAt ?? ""),
      ].join(" | ");
    }
    case "COLLECTIONS":
      return [
        String(row.collectionNumber ?? row.number ?? ""),
        String(row.status ?? ""),
        String((row.customer as { legalName?: string })?.legalName ?? ""),
        String(row.pickupCity ?? ""),
        String(row.scheduledDate ?? ""),
      ].join(" | ");
    case "INCIDENTS":
      return [
        String(row.incidentNumber ?? row.number ?? ""),
        String(row.type ?? ""),
        String(row.severity ?? ""),
        String(row.status ?? ""),
        String(
          (row.shipment as { trackingNumber?: string; number?: string })
            ?.trackingNumber ??
            (row.shipment as { number?: string })?.number ??
            "",
        ),
        String(row.createdAt ?? ""),
      ].join(" | ");
    case "REVENUE":
      return [
        String(row.invoiceNumber ?? row.number ?? ""),
        String(row.status ?? ""),
        String((row.customer as { legalName?: string })?.legalName ?? ""),
        String(row.totalAmount ?? ""),
        String(row.paidAmount ?? ""),
        String(row.issueDate ?? ""),
      ].join(" | ");
    default:
      return JSON.stringify(row);
  }
}

export function generateReportPdf(
  title: string,
  summary: DashboardSummary,
  rows: unknown[],
  type: ReportType,
): Buffer {
  const lines: string[] = [
    `Période: ${summary.period.label}`,
    `Généré le: ${new Date().toISOString()}`,
    "--- KPIs ---",
    `Expéditions: ${summary.kpis.totalShipments}`,
    `Livrées: ${summary.kpis.delivered}`,
    `En transit: ${summary.kpis.inTransit}`,
    `Taux de succès: ${summary.kpis.deliverySuccessRate}%`,
    `Revenus: ${summary.kpis.totalRevenue} MAD`,
    `Collectes: ${summary.kpis.collectionsTotal}`,
    `Incidents ouverts: ${summary.kpis.openIncidents}`,
    "--- Détail ---",
    ...rows
      .slice(0, 200)
      .map((r) => flattenRow(r as Record<string, unknown>, type)),
  ];

  if (rows.length > 200) {
    lines.push(
      `... (${rows.length - 200} lignes supplémentaires non affichées en PDF)`,
    );
  }

  return createMinimalPdf(title, lines);
}
