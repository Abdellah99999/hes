import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  Package,
  Layers,
  Search,
  Scale,
  Clock,
  AlertTriangle,
  Box,
} from "lucide-react";

interface StockParcel {
  id: string;
  trackingNumber: string;
  barcode: string;
  parcelIndex: number;
  weightKg: number;
  volumetricWeightKg: number | null;
  status: string;
  daysInStock: number;
  createdAt: string;
  parcelType?: { name: string; code: string };
  shipment?: {
    id: string;
    trackingNumber: string;
    recipientName: string;
    recipientCity: string;
    serviceType: string;
    originAgency?: { code: string };
    destinationAgency?: { code: string };
  };
}

interface StockResponse {
  summary: {
    agency: { id: string; code: string; name: string };
    totalParcels: number;
    totalWeightKg: number;
    totalVolumetricWeightKg: number;
    statusBreakdown: Record<string, number>;
    retentionAlertCount: number;
  };
  data: StockParcel[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const AgencyStockPage: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Agency ID of the authenticated operator
  const agencyId = user?.agencyId;

  const { data, isLoading } = useQuery({
    queryKey: ["agency-stock", agencyId, page, searchTerm, statusFilter],
    queryFn: async () => {
      if (!agencyId) return null;
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (statusFilter) params.append("status", statusFilter);

      return customFetch<StockResponse>(`/agencies/${agencyId}/stock?${params.toString()}`);
    },
    enabled: !!agencyId,
  });

  const summary = data?.summary;
  const parcels = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/10 text-amber-400 border border-amber-500/20 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <span>Stock Quai & Inventaire Physique Agence</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inventaire temps réel des colis physiquement stockés dans votre agence ({summary?.agency?.name || user?.agencyId})
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-4 backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Colis sur Quai</span>
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {summary?.totalParcels ?? 0}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-4 backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Poids Réel Cumulé</span>
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {summary ? (summary.totalWeightKg).toFixed(1) : 0} <span className="text-xs font-normal text-slate-400">kg</span>
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-4 backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Poids Volumétrique</span>
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {summary ? (summary.totalVolumetricWeightKg).toFixed(1) : 0} <span className="text-xs font-normal text-slate-400">kg</span>
            </span>
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border flex items-center gap-4 backdrop-blur-md ${
            summary && summary.retentionAlertCount > 0
              ? "bg-rose-950/30 border-rose-800/60 text-rose-300"
              : "bg-slate-900/60 border-slate-800 text-slate-100"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
              summary && summary.retentionAlertCount > 0
                ? "bg-rose-600/20 text-rose-400 border-rose-500/30"
                : "bg-slate-800/40 text-slate-400 border-slate-700/40"
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Alerte Rétention (&gt; 3j)</span>
            <span className="text-2xl font-bold font-mono">
              {summary?.retentionAlertCount ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrer par tracking, destinataire, ville..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tous les statuts quai</option>
            <option value="REGISTERED">Créé en agence (REGISTERED)</option>
            <option value="AT_HUB">Stock Quai Hub (AT_HUB)</option>
            <option value="OUT_FOR_DELIVERY">En Cours de Livraison</option>
            <option value="DELIVERY_FAILED">Échec Livraison (En attente)</option>
          </select>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Tracking Colis</th>
                <th className="px-4 py-3.5">Statut Quai</th>
                <th className="px-4 py-3.5">Destinataire & Ville</th>
                <th className="px-4 py-3.5">Poids</th>
                <th className="px-4 py-3.5">Temps de Rétention</th>
                <th className="px-4 py-3.5">Ligne Logistique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Calcul du stock quai...
                  </td>
                </tr>
              )}

              {!isLoading && parcels.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <span className="font-semibold block text-slate-300">Aucun colis en stock</span>
                    <span className="text-[11px] text-slate-500">
                      Votre quai est dégagé. Les nouveaux colis scannés apparaîtront ici.
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading &&
                parcels.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">
                      {p.trackingNumber}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-semibold text-[10px] text-slate-300">
                        {p.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">
                        {p.shipment?.recipientName || "--"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {p.shipment?.recipientCity || "--"}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-300 whitespace-nowrap">
                      {p.weightKg} kg
                      {p.volumetricWeightKg && (
                        <span className="text-[10px] text-slate-500 block">
                          Vol: {p.volumetricWeightKg.toFixed(1)} kg
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span
                          className={`font-semibold text-[11px] ${
                            p.daysInStock >= 3
                              ? "text-rose-400 font-bold"
                              : p.daysInStock >= 2
                              ? "text-amber-400"
                              : "text-slate-300"
                          }`}
                        >
                          {p.daysInStock === 0 ? "Aujourd'hui (< 24h)" : `${p.daysInStock} jour(s)`}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-[11px]">
                      {p.shipment?.originAgency?.code} → {p.shipment?.destinationAgency?.code}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
