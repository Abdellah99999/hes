import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Filter,
  Package,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Truck,
} from "lucide-react";
import customFetch from "../../../lib/api-client";

export interface DashboardKpis {
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
  [key: string]: number | undefined;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
}

export interface DashboardSummaryResponse {
  period: {
    from: string;
    to: string;
    label: string;
  };
  filters: Record<string, unknown>;
  kpis: DashboardKpis;
  statusBreakdown: StatusBreakdownItem[];
}

const periodOptions = [
  { value: "day", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Mois en cours" },
  { value: "year", label: "Année en cours" },
] as const;

const statusLabels: Record<string, { label: string; color: string; border: string; bg: string }> = {
  DELIVERED: { label: "Livrées", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  IN_TRANSIT: { label: "En transit", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10" },
  OUT_FOR_DELIVERY: { label: "En livraison", color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10" },
  REGISTERED: { label: "Enregistrées", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  DRAFT: { label: "Brouillon", color: "text-slate-400", border: "border-slate-500/30", bg: "bg-slate-500/10" },
  RETURNED: { label: "Retournées", color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
  CANCELLED: { label: "Annulées", color: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-500/10" },
};

interface DashboardPageProps {
  onNavigateToReports?: (reportType?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToReports }) => {
  const [period, setPeriod] = useState("month");
  const [status, setStatus] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [courierId, setCourierId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState({
    period: "month",
    status: undefined as string | undefined,
    agencyId: undefined as string | undefined,
    courierId: undefined as string | undefined,
    customerId: undefined as string | undefined,
  });

  const { data, isLoading, isFetching, refetch } = useQuery<DashboardSummaryResponse>({
    queryKey: ["reports-dashboard-summary", appliedFilters],
    queryFn: () =>
      customFetch<DashboardSummaryResponse>("/reports/dashboard", {
        params: {
          period: appliedFilters.period,
          status: appliedFilters.status,
          agencyId: appliedFilters.agencyId,
          courierId: appliedFilters.courierId,
          customerId: appliedFilters.customerId,
        },
      }),
  });

  const kpis: DashboardKpis = useMemo(
    () =>
      data?.kpis ?? {
        totalShipments: 0,
        delivered: 0,
        inTransit: 0,
        outForDelivery: 0,
        pending: 0,
        cancelled: 0,
        returned: 0,
        collectionsTotal: 0,
        collectionsCompleted: 0,
        openIncidents: 0,
        deliverySuccessRate: 0,
        totalRevenue: 0,
      },
    [data],
  );

  const statusBreakdown = data?.statusBreakdown ?? [];
  const totalInBreakdown = useMemo(
    () => statusBreakdown.reduce((acc, curr) => acc + curr.count, 0) || 1,
    [statusBreakdown],
  );

  const handleApplyFilters = () => {
    setAppliedFilters({
      period,
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
    setAppliedFilters({
      period: "month",
      status: undefined,
      agencyId: undefined,
      courierId: undefined,
      customerId: undefined,
    });
  };

  const handleQuickExport = async (format: "pdf" | "excel") => {
    try {
      setIsExporting(true);
      const blob = await customFetch<Blob>("/reports/export", {
        params: {
          type: "SHIPMENTS",
          period: appliedFilters.period,
          format,
          status: appliedFilters.status,
          agencyId: appliedFilters.agencyId,
          courierId: appliedFilters.courierId,
          customerId: appliedFilters.customerId,
        },
        responseType: "blob",
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `hes-dashboard-${appliedFilters.period}-${Date.now()}.${format === "excel" ? "csv" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Erreur lors de l'export rapide:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded-2xl shadow-inner">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                  Dashboard Opérationnel
                </h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Temps Réel
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Indicateurs clés, performance de distribution, surveillance des incidents et flux financier.
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
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleQuickExport("pdf")}
            className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-rose-900/20"
          >
            <FileText className="w-4 h-4" />
            PDF Rapide
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleQuickExport("excel")}
            className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-900/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel Rapide
          </button>

          {onNavigateToReports && (
            <button
              type="button"
              onClick={() => onNavigateToReports()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-600/30"
            >
              <span>Centre de Rapports</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Modern Filter Ribbon */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Filter className="w-4 h-4 text-blue-400" />
            <span>Filtres Multidimensionnels</span>
            {data?.period?.label && (
              <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                {data.period.label}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-xs text-slate-400">
            Période
            <select
              aria-label="Période"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none text-xs"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Statut Expédition
            <select
              aria-label="Statut Expédition"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none text-xs"
            >
              <option value="">Tous les statuts</option>
              <option value="DELIVERED">Livrées (DELIVERED)</option>
              <option value="IN_TRANSIT">En transit (IN_TRANSIT)</option>
              <option value="OUT_FOR_DELIVERY">En cours de livraison (OUT_FOR_DELIVERY)</option>
              <option value="REGISTERED">Enregistrées (REGISTERED)</option>
              <option value="RETURNED">Retournées (RETURNED)</option>
              <option value="CANCELLED">Annulées (CANCELLED)</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Agence
            <input
              aria-label="Agence"
              type="text"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              placeholder="UUID de l'agence…"
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none text-xs"
            />
          </label>

          <label className="text-xs text-slate-400">
            Livreur
            <input
              aria-label="Livreur"
              type="text"
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
              placeholder="UUID du livreur…"
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none text-xs"
            />
          </label>

          <label className="text-xs text-slate-400">
            Client B2B / Particulier
            <input
              aria-label="Client"
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="UUID du client…"
              className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-blue-500 focus:outline-none text-xs"
            />
          </label>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expéditions */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-cyan-500/20 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              Total Expéditions
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-300">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-100">
              {isLoading ? "…" : kpis.totalShipments.toLocaleString("fr-FR")}
            </div>
            <div className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
              <span>{kpis.pending} en attente</span>
              <span>•</span>
              <span className="text-cyan-300 font-medium">100% tracé</span>
            </div>
          </div>
        </div>

        {/* Livrées avec succès */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-emerald-500/20 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Livrées Avec Succès
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-100">
              {isLoading ? "…" : kpis.delivered.toLocaleString("fr-FR")}
            </div>
            <div className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
              <span className="text-emerald-400 font-semibold">{kpis.deliverySuccessRate}%</span>
              <span>de réussite terminale</span>
            </div>
          </div>
        </div>

        {/* Taux de succès */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-indigo-500/20 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
              Taux de Livraison
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-300">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-100">
              {isLoading ? "…" : `${kpis.deliverySuccessRate}%`}
            </div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, kpis.deliverySuccessRate))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Revenu Total */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-amber-500/20 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Chiffre d&apos;Affaires
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-100">
              {isLoading ? "…" : `${Number(kpis.totalRevenue).toLocaleString("fr-FR")} MAD`}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Frais d&apos;expédition consolidés
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* En transit & En cours */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">En cours / Transit</div>
              <div className="text-xl font-bold text-slate-100">
                {kpis.inTransit + kpis.outForDelivery}
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <div>Transit: <span className="font-semibold text-slate-200">{kpis.inTransit}</span></div>
            <div>Livraison: <span className="font-semibold text-slate-200">{kpis.outForDelivery}</span></div>
          </div>
        </div>

        {/* Collectes */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Collectes / Enlèvements</div>
              <div className="text-xl font-bold text-slate-100">
                {kpis.collectionsCompleted} <span className="text-xs text-slate-400 font-normal">/ {kpis.collectionsTotal}</span>
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <div className="text-emerald-400 font-semibold">
              {kpis.collectionsTotal > 0
                ? `${Math.round((kpis.collectionsCompleted / kpis.collectionsTotal) * 100)}%`
                : "100%"}
            </div>
            <div>réalisées</div>
          </div>
        </div>

        {/* Retours & Annulations */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Retours & Annulations</div>
              <div className="text-xl font-bold text-slate-100">
                {kpis.returned + kpis.cancelled}
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <div>Retours: <span className="font-semibold text-orange-300">{kpis.returned}</span></div>
            <div>Annulés: <span className="font-semibold text-rose-300">{kpis.cancelled}</span></div>
          </div>
        </div>

        {/* Incidents Ouverts */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Incidents Ouverts</div>
              <div className="text-xl font-bold text-rose-400">
                {kpis.openIncidents}
              </div>
            </div>
          </div>
          <div className="text-right text-[11px]">
            {kpis.openIncidents > 0 ? (
              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold">
                Action requise
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                R.A.S.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Analytics Grid: Breakdown & Direct Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Bar */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">Répartition des Statuts de Colis</h2>
              <p className="text-xs text-slate-400">Ventilation en volume de toutes les expéditions de la période sélectionnée.</p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-800/30">
              {kpis.totalShipments} flux totaux
            </span>
          </div>

          {statusBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Aucune donnée d&apos;expédition trouvée pour les critères appliqués.
            </div>
          ) : (
            <div className="space-y-3.5">
              {statusBreakdown.map((item) => {
                const config = statusLabels[item.status] ?? {
                  label: item.status,
                  color: "text-slate-300",
                  border: "border-slate-700",
                  bg: "bg-slate-800",
                };
                const percentage = Math.round((item.count / totalInBreakdown) * 100);

                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${config.border} ${config.bg} ${config.color}`}>
                          {item.status}
                        </span>
                        <span className="text-slate-300 font-medium">{config.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 font-mono">
                        <span className="font-semibold text-slate-100">{item.count.toLocaleString("fr-FR")}</span>
                        <span className="text-[11px] text-slate-500">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.status === "DELIVERED"
                            ? "bg-emerald-500"
                            : item.status === "IN_TRANSIT"
                            ? "bg-amber-500"
                            : item.status === "OUT_FOR_DELIVERY"
                            ? "bg-sky-500"
                            : item.status === "CANCELLED"
                            ? "bg-rose-500"
                            : item.status === "RETURNED"
                            ? "bg-orange-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Report Shortcuts */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100 mb-1">Rapports &amp; Analyses Détaillés</h2>
            <p className="text-xs text-slate-400 mb-4">
              Consultez les tables d&apos;enregistrements bruts et exportez vos données certifiées.
            </p>

            <div className="space-y-2">
              <ReportShortcutButton
                title="Rapport Expéditions"
                desc="Tracking, adresses et frais de livraison"
                icon={<Package className="w-4 h-4 text-cyan-400" />}
                onClick={() => onNavigateToReports?.("SHIPMENTS")}
              />
              <ReportShortcutButton
                title="Rapport Livraisons"
                desc="Pointages quai, tournées et livreurs"
                icon={<Truck className="w-4 h-4 text-emerald-400" />}
                onClick={() => onNavigateToReports?.("DELIVERIES")}
              />
              <ReportShortcutButton
                title="Rapport Collectes"
                desc="Enlèvements planifiés et statut des ramassages"
                icon={<PackageCheck className="w-4 h-4 text-sky-400" />}
                onClick={() => onNavigateToReports?.("COLLECTIONS")}
              />
              <ReportShortcutButton
                title="Rapport Incidents"
                desc="Suivi des litiges, anomalies et réclamations"
                icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
                onClick={() => onNavigateToReports?.("INCIDENTS")}
              />
              <ReportShortcutButton
                title="Rapport Revenus &amp; Factures"
                desc="Encaissements, facturation et créances"
                icon={<DollarSign className="w-4 h-4 text-amber-400" />}
                onClick={() => onNavigateToReports?.("REVENUE")}
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Conformité RBAC &amp; Agence</span>
            <span className="text-emerald-400 font-semibold">Strictement Scruté</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportShortcutButton: React.FC<{
  title: string;
  desc: string;
  icon: React.ReactNode;
  onClick?: () => void;
}> = ({ title, desc, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 text-left flex items-center justify-between transition-all group"
  >
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
          {title}
        </div>
        <div className="text-[10px] text-slate-400">{desc}</div>
      </div>
    </div>
    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
  </button>
);
