import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { TransferPrepModal } from "../components/TransferPrepModal";
import {
  TransferReceiveModal,
  TransferDetail,
} from "../components/TransferReceiveModal";
import { PermissionGate } from "../../auth/components/PermissionGate";
import {
  Truck,
  Plus,
  Search,
  Send,
  Download,
} from "lucide-react";

export const TransfersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [selectedTransferForReceive, setSelectedTransferForReceive] =
    useState<TransferDetail | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["transfers", page, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (statusFilter) params.append("status", statusFilter);

      return customFetch<{
        data: TransferDetail[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>(`/transfers?${params.toString()}`);
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (transferId: string) => {
      return customFetch(`/transfers/${transferId}/dispatch`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["agency-stock"] });
      refetch();
    },
  });

  const transfers = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <span>Transferts Inter-Agences & Lignes Régulières</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manifestes camion, départs scellés et réconciliation de quai à l'arrivée
          </p>
        </div>

        <PermissionGate permissions={["transfers:create"]}>
          <button
            onClick={() => setIsPrepModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Transfert</span>
          </button>
        </PermissionGate>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Recherche par numéro, plaque, chauffeur..."
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
            <option value="">Tous les statuts</option>
            <option value="PREPARED">En Préparation (PREPARED)</option>
            <option value="IN_TRANSIT">Sur la Route (IN_TRANSIT)</option>
            <option value="RECEIVED">Reçu Conforme (RECEIVED)</option>
            <option value="RECEIVED_WITH_DISCREPANCY">Reçu Avec Écart</option>
          </select>
        </div>
      </div>

      {/* Transfers Data Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Numéro Transfert</th>
                <th className="px-4 py-3.5">Acheminement</th>
                <th className="px-4 py-3.5">Statut</th>
                <th className="px-4 py-3.5">Véhicule / Chauffeur</th>
                <th className="px-4 py-3.5">Scellé</th>
                <th className="px-4 py-3.5">Colis Attendus</th>
                <th className="px-4 py-3.5 text-right">Actions Quai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Chargement des transferts...
                  </td>
                </tr>
              )}

              {!isLoading && transfers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <span className="font-semibold block text-slate-300">Aucun transfert trouvé</span>
                    <span className="text-[11px] text-slate-500">
                      Préparez votre premier transfert camion pour expédier vos colis quai.
                    </span>
                  </td>
                </tr>
              )}

              {!isLoading &&
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">
                      {t.transferNumber}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                        <span>{t.originAgency?.code}</span>
                        <span className="text-slate-500">→</span>
                        <span>{t.destinationAgency?.code}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {t.originAgency?.name} à {t.destinationAgency?.name}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {t.status === "PREPARED" && (
                        <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-semibold text-[10px]">
                          EN PRÉPARATION
                        </span>
                      )}
                      {t.status === "IN_TRANSIT" && (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-semibold text-[10px]">
                          EN TRANSIT
                        </span>
                      )}
                      {t.status === "RECEIVED" && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold text-[10px]">
                          REÇU CONFORME
                        </span>
                      )}
                      {t.status === "RECEIVED_WITH_DISCREPANCY" && (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-semibold text-[10px]">
                          REÇU AVEC ÉCART
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-mono text-slate-200">{t.vehiclePlate || "--"}</div>
                      <div className="text-[10px] text-slate-400">{t.driverName || "--"}</div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-300 text-[11px] whitespace-nowrap">
                      {t.sealNumber || "--"}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-200 whitespace-nowrap">
                      {t.totalExpectedParcels} colis
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {t.status === "PREPARED" && (
                          <button
                            onClick={() => dispatchMutation.mutate(t.id)}
                            disabled={dispatchMutation.isPending}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Départ Camion</span>
                          </button>
                        )}

                        {t.status === "IN_TRANSIT" && (
                          <button
                            onClick={() => setSelectedTransferForReceive(t)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Réceptionner</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <TransferPrepModal
        isOpen={isPrepModalOpen}
        onClose={() => setIsPrepModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <TransferReceiveModal
        isOpen={!!selectedTransferForReceive}
        transfer={selectedTransferForReceive}
        onClose={() => setSelectedTransferForReceive(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
