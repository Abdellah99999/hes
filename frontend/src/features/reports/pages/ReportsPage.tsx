import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import customFetch from "../../../lib/api-client";

export const reportTypes = [
  { value: "SHIPMENTS", label: "Expéditions", desc: "Suivi des colis et tarifs" },
  { value: "DELIVERIES", label: "Livraisons Quai", desc: "Pointages des tournées et livreurs" },
  { value: "COLLECTIONS", label: "Collectes", desc: "Enlèvements planifiés et ramassages" },
  { value: "INCIDENTS", label: "Incidents & Litiges", desc: "Anomalies, avaries et pertes" },
  { value: "REVENUE", label: "Revenus & Factures", desc: "Comptabilité et encaissements" },
] as const;

export type ReportTypeValue = (typeof reportTypes)[number]["value"];

export const periods = [
  { value: "day", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Mois en cours" },
  { value: "year", label: "Année en cours" },
] as const;

export interface ReportRow {
  id: string;
  number?: string;
  trackingNumber?: string;
  invoiceNumber?: string;
  incidentNumber?: string;
  collectionNumber?: string;
  globalStatus?: string;
  status?: string;
  type?: string;
  severity?: string;
  recipientName?: string;
  recipientCity?: string;
  pickupCity?: string;
  shippingFee?: number;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  scheduledDate?: string;
  deliveredAt?: string;
  failedAt?: string;
  createdAt?: string;
  issueDate?: string;
  customer?: {
    code?: string;
    legalName?: string;
    city?: string;
  } | null;
  senderCustomer?: {
    code?: string;
    legalName?: string;
  } | null;
  originAgency?: {
    code?: string;
    name?: string;
  } | null;
  destinationAgency?: {
    code?: string;
    name?: string;
  } | null;
  agency?: {
    code?: string;
    name?: string;
  } | null;
  assignedCourier?: {
    firstName?: string;
    lastName?: string;
  } | null;
  deliveryRun?: {
    number?: string;
    runNumber?: string;
    runDate?: string;
    courier?: {
      user?: {
        firstName?: string;
        lastName?: string;
      };
    };
  } | null;
  parcel?: {
    number?: string;
    trackingNumber?: string;
    shipment?: {
      number?: string;
      trackingNumber?: string;
      recipientName?: string;
      recipientCity?: string;
    };
  } | null;
  shipment?: {
    number?: string;
    trackingNumber?: string;
    originAgency?: {
      code?: string;
    };
  } | null;
  [key: string]: unknown;
}

export interface ReportDataResponse {
  data: ReportRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface ReportsPageProps {
  initialReportType?: ReportTypeValue;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ initialReportType = "SHIPMENTS" }) => {
  const [reportType, setReportType] = useState<ReportTypeValue>(initialReportType);
  const [period, setPeriod] = useState("month");
  const [status, setStatus] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [courierId, setCourierId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [appliedFilters, setAppliedFilters] = useState({
    period: "month",
    type: initialReportType,
    status: undefined as string | undefined,
    agencyId: undefined as string | undefined,
    courierId: undefined as string | undefined,
    customerId: undefined as string | undefined,
  });

  const queryParams = useMemo(
    () => ({
      period: appliedFilters.period,
      type: appliedFilters.type,
      status: appliedFilters.status,
      agencyId: appliedFilters.agencyId,
      courierId: appliedFilters.courierId,
      customerId: appliedFilters.customerId,
      page: currentPage,
      limit: 20,
    }),
    [appliedFilters, currentPage],
  );

  const { data, isLoading, isFetching, refetch } = useQuery<ReportDataResponse>({
    queryKey: ["reports-data", queryParams],
    queryFn: () =>
      customFetch<ReportDataResponse>("/reports/data", {
        params: queryParams,
      }),
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setExportError(null);
    setAppliedFilters({
      period,
      type: reportType,
      status: status || undefined,
      agencyId: agencyId || undefined,
      courierId: courierId || undefined,
      customerId: customerId || undefined,
    });
  };

  const handleResetFilters = () => {
    setPeriod("month");
    setStatus("");
    setAgencyId("");
    setCourierId("");
    setCustomerId("");
    setCurrentPage(1);
    setExportError(null);
    setAppliedFilters({
      period: "month",
      type: reportType,
      status: undefined,
      agencyId: undefined,
      courierId: undefined,
      customerId: undefined,
    });
  };

  const handleExport = async (format: "pdf" | "excel") => {
    try {
      setIsExporting(true);
      setExportError(null);
      const params: Record<string, string | number | boolean | undefined> = {
        type: appliedFilters.type,
        period: appliedFilters.period,
        format,
        status: appliedFilters.status,
        agencyId: appliedFilters.agencyId,
        courierId: appliedFilters.courierId,
        customerId: appliedFilters.customerId,
      };

      const blob = await customFetch<Blob>("/reports/export", {
        params,
        responseType: "blob",
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `hes-rapport-${appliedFilters.type.toLowerCase()}-${appliedFilters.period}-${Date.now()}.${
        format === "excel" ? "csv" : "pdf"
      }`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: unknown) {
      console.error("Erreur lors de l'export du rapport:", err);
      const message =
        err instanceof Error ? err.message : "Erreur inattendue lors de l'exportation du fichier.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-600/10 text-cyan-400 border border-cyan-500/30 rounded-2xl">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                Centre de Rapports &amp; Exports
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Extraction granulaire, audit multi-agences et génération de fichiers PDF / Excel certifiés.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualiser les données"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExport("pdf")}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-rose-900/30"
          >
            <FileText className="w-4 h-4" />
            <span>{isExporting ? "Génération…" : "Exporter PDF"}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExport("excel")}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-900/30"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExporting ? "Génération…" : "Exporter Excel"}</span>
          </button>
        </div>
      </div>

      {/* Security & Multi-Agency banner */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            <strong className="text-slate-200">Isolation Multi-Agences :</strong> Les données affichées et exportées sont strictement confinées à vos permissions (Agence / Rôle). Plafond de sécurité : 10 000 lignes par export.
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-cyan-400">
          <Download className="w-3.5 h-3.5" />
          <span>Max 10 000 rows</span>
        </div>
      </div>

      {exportError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Report Type Selector Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {reportTypes.map((type) => {
          const isSelected = reportType === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => {
                setReportType(type.value);
                setAppliedFilters((prev) => ({ ...prev, type: type.value }));
                setCurrentPage(1);
              }}
              className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-950/50"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="text-xs font-bold">{type.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{type.desc}</div>
              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter Control Box */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>Filtres de Sélection ({reportTypes.find((r) => r.value === appliedFilters.type)?.label})</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
            >
              <Filter className="w-3.5 h-3.5" />
              Appliquer
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <label className="text-xs text-slate-400">
            Période
            <select
              aria-label="Période"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
            >
              {periods.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Type de rapport
            <select
              aria-label="Type de rapport"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportTypeValue)}
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
            >
              {reportTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Statut
            <select
              aria-label="Statut"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="DELIVERED">DELIVERED (Livrée / Complétée)</option>
              <option value="IN_TRANSIT">IN_TRANSIT (En transit)</option>
              <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY (En tournée)</option>
              <option value="REGISTERED">REGISTERED (Enregistrée)</option>
              <option value="COMPLETED">COMPLETED (Terminée)</option>
              <option value="FAILED">FAILED (Échouée)</option>
              <option value="RETURNED">RETURNED (Retournée)</option>
              <option value="CANCELLED">CANCELLED (Annulée)</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Filtre Agence
            <input
              aria-label="Agence"
              type="text"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              placeholder="UUID agence…"
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
            />
          </label>

          <label className="text-xs text-slate-400">
            Filtre Livreur
            <input
              aria-label="Livreur"
              type="text"
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
              placeholder="UUID livreur…"
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
            />
          </label>

          <label className="text-xs text-slate-400">
            Filtre Client
            <input
              aria-label="Client"
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="UUID client…"
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-slate-100">
              Résultats : {reportTypes.find((r) => r.value === appliedFilters.type)?.label}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {meta.total} ligne{meta.total > 1 ? "s" : ""} trouvée{meta.total > 1 ? "s" : ""}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
            <span>Chargement des données en cours…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Aucun enregistrement ne correspond aux critères sélectionnés.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Partie Prenante</th>
                  <th className="px-4 py-3">Localisation</th>
                  <th className="px-4 py-3">Complément / Assigné</th>
                  <th className="px-4 py-3 text-right">Montant / Frais</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row) => (
                  <TableRow key={row.id} row={row} type={appliedFilters.type} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Page <span className="font-semibold text-slate-200">{meta.page}</span> sur{" "}
            <span className="font-semibold text-slate-200">{meta.totalPages}</span> ({meta.total} enregistrements)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!meta.hasPrevPage || isFetching}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Précédent</span>
            </button>

            <button
              type="button"
              disabled={!meta.hasNextPage || isFetching}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg flex items-center gap-1 transition-all"
            >
              <span>Suivant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TableRow: React.FC<{ row: ReportRow; type: ReportTypeValue }> = ({ row, type }) => {
  switch (type) {
    case "SHIPMENTS": {
      const tracking = row.trackingNumber ?? row.number ?? row.id;
      return (
        <tr className="hover:bg-slate-800/40 transition-colors">
          <td className="px-4 py-3 font-mono font-bold text-cyan-300">{tracking}</td>
          <td className="px-4 py-3">
            <StatusBadge status={row.globalStatus ?? row.status ?? "UNKNOWN"} />
          </td>
          <td className="px-4 py-3">
            <div className="font-medium text-slate-200">{row.recipientName ?? "N/A"}</div>
            <div className="text-[10px] text-slate-400">
              Exp : {row.senderCustomer?.legalName ?? "Client Standard"}
            </div>
          </td>
          <td className="px-4 py-3 text-slate-300">{row.recipientCity ?? "N/A"}</td>
          <td className="px-4 py-3 text-slate-400">
            {row.originAgency?.code ? `Agence ${row.originAgency.code}` : "-"}
          </td>
          <td className="px-4 py-3 text-right font-mono font-medium text-slate-200">
            {row.shippingFee != null ? `${Number(row.shippingFee).toLocaleString("fr-FR")} MAD` : "-"}
          </td>
          <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
            {row.createdAt ? new Date(row.createdAt).toLocaleDateString("fr-FR") : "-"}
          </td>
        </tr>
      );
    }

    case "DELIVERIES": {
      const parcel = row.parcel;
      const shipment = parcel?.shipment;
      const courierUser = row.deliveryRun?.courier?.user;
      return (
        <tr className="hover:bg-slate-800/40 transition-colors">
          <td className="px-4 py-3 font-mono font-bold text-cyan-300">
            {parcel?.trackingNumber ?? parcel?.number ?? row.id}
          </td>
          <td className="px-4 py-3">
            <StatusBadge status={row.status ?? "PENDING"} />
          </td>
          <td className="px-4 py-3">
            <div className="font-medium text-slate-200">{shipment?.recipientName ?? "Destinataire"}</div>
            <div className="text-[10px] text-slate-400">Expéd. {shipment?.trackingNumber ?? "-"}</div>
          </td>
          <td className="px-4 py-3 text-slate-300">{shipment?.recipientCity ?? "N/A"}</td>
          <td className="px-4 py-3 text-slate-400">
            <div className="text-slate-200">
              {courierUser ? `${courierUser.firstName ?? ""} ${courierUser.lastName ?? ""}`.trim() : "Non assigné"}
            </div>
            <div className="text-[10px] text-slate-500">Tournée {row.deliveryRun?.number ?? row.deliveryRun?.runNumber ?? "-"}</div>
          </td>
          <td className="px-4 py-3 text-right font-mono text-slate-400">-</td>
          <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
            {row.deliveredAt ? new Date(row.deliveredAt).toLocaleDateString("fr-FR") : "-"}
          </td>
        </tr>
      );
    }

    case "COLLECTIONS": {
      return (
        <tr className="hover:bg-slate-800/40 transition-colors">
          <td className="px-4 py-3 font-mono font-bold text-cyan-300">
            {row.collectionNumber ?? row.number ?? row.id}
          </td>
          <td className="px-4 py-3">
            <StatusBadge status={row.status ?? "REQUESTED"} />
          </td>
          <td className="px-4 py-3 font-medium text-slate-200">
            {row.customer?.legalName ?? "Client"}
          </td>
          <td className="px-4 py-3 text-slate-300">{row.pickupCity ?? "N/A"}</td>
          <td className="px-4 py-3 text-slate-400">
            {row.assignedCourier
              ? `${row.assignedCourier.firstName ?? ""} ${row.assignedCourier.lastName ?? ""}`.trim()
              : "Non assigné"}
          </td>
          <td className="px-4 py-3 text-right font-mono text-slate-400">-</td>
          <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
            {row.scheduledDate ? new Date(row.scheduledDate).toLocaleDateString("fr-FR") : "-"}
          </td>
        </tr>
      );
    }

    case "INCIDENTS": {
      return (
        <tr className="hover:bg-slate-800/40 transition-colors">
          <td className="px-4 py-3 font-mono font-bold text-rose-300">
            {row.incidentNumber ?? row.number ?? row.id}
          </td>
          <td className="px-4 py-3">
            <StatusBadge status={row.status ?? "REPORTED"} />
          </td>
          <td className="px-4 py-3">
            <div className="font-semibold text-slate-200">{row.type ?? "ANOMALIE"}</div>
            <div className="text-[10px] text-amber-400">Sévérité : {row.severity ?? "MEDIUM"}</div>
          </td>
          <td className="px-4 py-3 text-slate-300 font-mono">
            {row.shipment?.trackingNumber ?? "-"}
          </td>
          <td className="px-4 py-3 text-slate-400">
            {row.shipment?.originAgency?.code ? `Agence ${row.shipment.originAgency.code}` : "-"}
          </td>
          <td className="px-4 py-3 text-right font-mono text-slate-400">-</td>
          <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
            {row.createdAt ? new Date(row.createdAt).toLocaleDateString("fr-FR") : "-"}
          </td>
        </tr>
      );
    }

    case "REVENUE": {
      const remaining = row.remainingAmount ?? (Number(row.totalAmount || 0) - Number(row.paidAmount || 0));
      return (
        <tr className="hover:bg-slate-800/40 transition-colors">
          <td className="px-4 py-3 font-mono font-bold text-amber-300">
            {row.invoiceNumber ?? row.number ?? row.id}
          </td>
          <td className="px-4 py-3">
            <StatusBadge status={row.status ?? "ISSUED"} />
          </td>
          <td className="px-4 py-3 font-medium text-slate-200">
            {row.customer?.legalName ?? "Client B2B"}
          </td>
          <td className="px-4 py-3 text-slate-400 font-mono">
            Payé : {Number(row.paidAmount || 0).toLocaleString("fr-FR")} MAD
          </td>
          <td className="px-4 py-3 font-mono text-slate-300">
            Reste : <span className={remaining > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{remaining.toLocaleString("fr-FR")} MAD</span>
          </td>
          <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">
            {Number(row.totalAmount || 0).toLocaleString("fr-FR")} MAD
          </td>
          <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
            {row.issueDate ? new Date(row.issueDate).toLocaleDateString("fr-FR") : "-"}
          </td>
        </tr>
      );
    }
  }
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let badgeStyle = "bg-slate-800 text-slate-300 border-slate-700";

  switch (status) {
    case "DELIVERED":
    case "COMPLETED":
    case "PAID":
      badgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      break;
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "INVESTIGATING":
      badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/30";
      break;
    case "FAILED":
    case "CANCELLED":
    case "REPORTED":
    case "CRITICAL":
      badgeStyle = "bg-rose-500/10 text-rose-400 border-rose-500/30";
      break;
    case "RETURNED":
      badgeStyle = "bg-orange-500/10 text-orange-400 border-orange-500/30";
      break;
    case "REGISTERED":
    case "REQUESTED":
    case "ISSUED":
      badgeStyle = "bg-blue-500/10 text-blue-400 border-blue-500/30";
      break;
  }

  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}>
      {status}
    </span>
  );
};
