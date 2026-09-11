import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { ShipmentStatusBadge } from "../components/ShipmentStatusBadge";
import { ShipmentCreateModal } from "../components/ShipmentCreateModal";
import {
  ShipmentDetailModal,
  ShipmentDetail,
} from "../components/ShipmentDetailModal";
import { TrackingScannerModal } from "../components/TrackingScannerModal";
import { PermissionGate } from "../../auth/components/PermissionGate";
import {
  Package,
  Plus,
  Search,
  Truck,
  CheckCircle,
  AlertTriangle,
  Layers,
  Eye,
  Barcode,
} from "lucide-react";

export const ShipmentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentDetail | null>(
    null,
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shipments", page, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (statusFilter) params.append("globalStatus", statusFilter);

      return customFetch<{
        data: ShipmentDetail[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }>(`/shipments?${params.toString()}`);
    },
  });

  const shipments = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 15, totalPages: 1 };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Top Banner / Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <span>Gestion des Expéditions & Multi-Colis</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Traçabilité physique, agrégation de statuts et numérotation séquentielle par agence
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsScannerModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors self-start md:self-auto"
          >
            <Barcode className="w-4 h-4" />
            <span>Poste Scan Quai</span>
          </button>

          <PermissionGate permissions={["shipments:create"]}>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Expédition</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Total Expéditions</span>
              <span className="text-lg font-bold text-slate-100 font-mono">{meta.total}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">En Transit / Hub</span>
              <span className="text-lg font-bold text-amber-300 font-mono">
                {shipments.filter((s) => s.globalStatus === "IN_TRANSIT" || s.globalStatus === "OUT_FOR_DELIVERY").length}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Livrées (Totalité)</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {shipments.filter((s) => s.globalStatus === "DELIVERED").length}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Avaries / Exception</span>
              <span className="text-lg font-bold text-rose-400 font-mono">
                {shipments.filter((s) => s.globalStatus === "EXCEPTION").length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Recherche par tracking, destinataire..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-full sm:w-auto"
          >
            <option value="">Tous les statuts globaux</option>
            <option value="REGISTERED">Enregistrée (REGISTERED)</option>
            <option value="IN_TRANSIT">En Transit (IN_TRANSIT)</option>
            <option value="OUT_FOR_DELIVERY">En Livraison (OUT_FOR_DELIVERY)</option>
            <option value="DELIVERED">Livrée Complète (DELIVERED)</option>
            <option value="PARTIALLY_DELIVERED">Partiellement Livrée (PARTIALLY_DELIVERED)</option>
            <option value="RETURNED">Retournée (RETURNED)</option>
            <option value="EXCEPTION">Avarie / Litige (EXCEPTION)</option>
            <option value="CANCELLED">Annulée (CANCELLED)</option>
          </select>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3">Numéro Tracking</th>
                <th className="px-4 py-3">Acheminement</th>
                <th className="px-4 py-3">Expéditeur / Client</th>
                <th className="px-4 py-3">Destinataire</th>
                <th className="px-4 py-3">Statut Global</th>
                <th className="px-4 py-3 text-center">Colis & Poids</th>
                <th className="px-4 py-3 text-right">Frais</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Chargement des expéditions...
                  </td>
                </tr>
              )}

              {!isLoading && shipments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <span className="font-semibold block text-slate-300">Aucune expédition trouvée</span>
                    <span className="text-[11px] text-slate-500">
                      Créez votre première expédition avec colis multiples pour commencer.
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading &&
                shipments.map((shipment) => (
                  <tr
                    key={shipment.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">
                      {shipment.trackingNumber}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <span>{shipment.originAgency?.code || "ORG"}</span>
                        <span className="text-slate-500">→</span>
                        <span>{shipment.destinationAgency?.code || "DST"}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {shipment.serviceType}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 max-w-[160px] truncate">
                      <span className="font-medium text-slate-200 block truncate">
                        {shipment.senderCustomer?.legalName || "--"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {shipment.senderCustomer?.code}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 max-w-[160px] truncate">
                      <span className="font-medium text-slate-200 block truncate">
                        {shipment.recipientName}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {shipment.recipientCity}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <ShipmentStatusBadge status={shipment.globalStatus} size="sm" />
                    </td>

                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-mono font-bold text-slate-100">
                          {shipment.totalParcels}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="font-mono text-slate-300">
                          {shipment.totalWeightKg.toFixed(1)} kg
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {Number(shipment.shippingFee).toFixed(2)} MAD
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedShipment(shipment)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Détails & Colis</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {meta.page} sur {meta.totalPages} ({meta.total} expéditions)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ShipmentCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <ShipmentDetailModal
        isOpen={!!selectedShipment}
        shipment={selectedShipment}
        onClose={() => {
          setSelectedShipment(null);
          refetch();
        }}
      />

      <TrackingScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
