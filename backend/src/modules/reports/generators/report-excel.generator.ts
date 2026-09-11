import { ReportType } from "../domain/report.types";

function csvEscape(val: unknown): string {
  const str = val == null ? "" : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function headersForType(type: ReportType): string[] {
  switch (type) {
    case "SHIPMENTS":
      return [
        "Tracking",
        "Statut",
        "Client",
        "Destinataire",
        "Ville",
        "Agence origine",
        "Frais",
        "Date création",
      ];
    case "DELIVERIES":
      return [
        "Colis",
        "Statut",
        "Destinataire",
        "Livreur",
        "Date livraison/échec",
      ];
    case "COLLECTIONS":
      return ["N° Collecte", "Statut", "Client", "Ville", "Date planifiée"];
    case "INCIDENTS":
      return [
        "N° Incident",
        "Type",
        "Sévérité",
        "Statut",
        "Expédition",
        "Date",
      ];
    case "REVENUE":
      return [
        "N° Facture",
        "Statut",
        "Client",
        "Montant total",
        "Payé",
        "Date émission",
      ];
    default:
      return ["data"];
  }
}

function rowToCells(row: Record<string, unknown>, type: ReportType): string[] {
  switch (type) {
    case "SHIPMENTS":
      return [
        csvEscape(row.trackingNumber ?? row.number),
        csvEscape(row.globalStatus),
        csvEscape((row.senderCustomer as { legalName?: string })?.legalName),
        csvEscape(row.recipientName),
        csvEscape(row.recipientCity),
        csvEscape((row.originAgency as { code?: string })?.code),
        csvEscape(row.shippingFee),
        csvEscape(row.createdAt),
      ];
    case "DELIVERIES": {
      const parcel = row.parcel as Record<string, unknown> | undefined;
      const run = row.deliveryRun as Record<string, unknown> | undefined;
      const courier = (run?.courier as Record<string, unknown>)?.user as
        Record<string, string> | undefined;
      return [
        csvEscape(parcel?.trackingNumber ?? parcel?.number),
        csvEscape(row.status),
        csvEscape(
          (parcel?.shipment as { recipientName?: string })?.recipientName,
        ),
        csvEscape(
          `${courier?.firstName ?? ""} ${courier?.lastName ?? ""}`.trim(),
        ),
        csvEscape(row.deliveredAt ?? row.failedAt ?? row.updatedAt),
      ];
    }
    case "COLLECTIONS":
      return [
        csvEscape(row.collectionNumber ?? row.number),
        csvEscape(row.status),
        csvEscape((row.customer as { legalName?: string })?.legalName),
        csvEscape(row.pickupCity),
        csvEscape(row.scheduledDate),
      ];
    case "INCIDENTS":
      return [
        csvEscape(row.incidentNumber ?? row.number),
        csvEscape(row.type),
        csvEscape(row.severity),
        csvEscape(row.status),
        csvEscape(
          (row.shipment as { trackingNumber?: string; number?: string })
            ?.trackingNumber ??
            (row.shipment as { number?: string })?.number,
        ),
        csvEscape(row.createdAt),
      ];
    case "REVENUE":
      return [
        csvEscape(row.invoiceNumber ?? row.number),
        csvEscape(row.status),
        csvEscape((row.customer as { legalName?: string })?.legalName),
        csvEscape(row.totalAmount),
        csvEscape(row.paidAmount),
        csvEscape(row.issueDate),
      ];
    default:
      return [csvEscape(JSON.stringify(row))];
  }
}

export function generateReportExcel(
  _title: string,
  rows: unknown[],
  type: ReportType,
): Buffer {
  const headers = headersForType(type);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      rowToCells(r as Record<string, unknown>, type).join(","),
    ),
  ];
  // UTF-8 BOM for Excel compatibility
  return Buffer.from("\uFEFF" + lines.join("\n"), "utf8");
}
