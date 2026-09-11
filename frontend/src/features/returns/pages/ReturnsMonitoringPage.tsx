import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  RotateCcw,
  Search,
  Building2,
  Calendar,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export interface ReturnItemDetail {
  id: string;
  status: string;
  originalTrackingNumber: string;
  originalBlNumber: string | null;
  recoveredViaScan: boolean;
  recoveredManually: boolean;
  isFallbackEmergency: boolean;
  emergencyReason: string | null;
  parcel: {
    id: string;
    trackingNumber: string;
    weightKg: number;
    status: string;
  };
}

export interface ReturnDossier {
  id: string;
  returnNumber: string;
  returnType: string;
  status: string;
  reasonNotes: string | null;
  createdAt: string;
  originAgency: { id: string; code: string; name: string };
  destinationAgency: { id: string; code: string; name: string };
  shipment: {
    id: string;
    trackingNumber: string;
    recipientName: string;
    recipientCity: string;
    senderCustomer: { id: string; legalName: string };
  };
  assignedCourier?: { id: string; firstName: string; lastName: string } | null;
  items: ReturnItemDetail[];
}

export const ReturnsMonitoringPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["returns", statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);
      return customFetch<{ data: ReturnDossier[]; meta: { total: number } }>(
        `/returns?${params.toString()}`,
      );
    },
  });

  const returns = data?.data || [];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/10 text-rose-400 border border-rose-500/20 rounded-xl">
              <RotateCcw className="w-6 h-6" />
            </div>
            <span>Suivi des Retours & Logistique Inverse</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Supervision des colis refusés, rapatriements vers agences d'origine et réconciliations de retours
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher RET- ou HES-..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="">Tous les statuts</option>
            <option value="INITIATED">Initié / En attente</option>
            <option value="PICKED_UP_BY_COURIER">Récupéré par livreur</option>
            <option value="RECEIVED_AT_HUB">Réceptionné au hub</option>
            <option value="IN_TRANSIT_RETURN">En transfert retour</option>
            <option value="DELIVERED_TO_SENDER">Restitué expéditeur</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Erreur lors du chargement des dossiers de retours.</span>
        </div>
      )}

      {isLoading && (
        <div className="p-12 text-center text-slate-500 text-xs">
          Chargement des dossiers de retour en cours...
        </div>
      )}

      {!isLoading && returns.length === 0 && (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-3">
          <RotateCcw className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-200">Aucun dossier de retour trouvé</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Les dossiers de retours sont générés automatiquement lors des refus destinataires ou initiés manuellement par le quai.
          </p>
        </div>
      )}

      {!isLoading && returns.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {returns.map((ret) => (
            <div
              key={ret.id}
              className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4 shadow-xl shadow-black/20"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-400 text-sm">
                      {ret.returnNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                      {ret.returnType}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300 text-[10px] font-semibold">
                      {ret.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Expédition liée : <strong className="text-slate-200 font-mono">{ret.shipment.trackingNumber}</strong>
                  </span>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  <div className="flex items-center gap-1 justify-end font-medium text-slate-300">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>{new Date(ret.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <span className="text-slate-500">
                    {ret.assignedCourier ? `${ret.assignedCourier.firstName} ${ret.assignedCourier.lastName}` : "Non assigné"}
                  </span>
                </div>
              </div>

              {/* Agencies routing info */}
              <div className="p-2.5 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                    Agence de retour (Constat)
                  </span>
                  <div className="flex items-center gap-1 font-bold text-slate-200">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{ret.originAgency.name} ({ret.originAgency.code})</span>
                  </div>
                </div>

                <span className="text-rose-500 font-bold">&rarr;</span>

                <div className="space-y-0.5 text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                    Agence Destinataire (Expéditeur)
                  </span>
                  <div className="flex items-center gap-1 justify-end font-bold text-slate-200">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{ret.destinationAgency.name} ({ret.destinationAgency.code})</span>
                  </div>
                </div>
              </div>

              {/* Items in this return */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Colis inclus dans le retour ({ret.items.length})
                </div>

                <div className="space-y-1.5">
                  {ret.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-200">
                            {it.originalTrackingNumber}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {it.status}
                          </span>
                          {it.isFallbackEmergency && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[9px] font-semibold flex items-center gap-1">
                              <HelpCircle className="w-2.5 h-2.5" />
                              <span>Secours BL perdu</span>
                            </span>
                          )}
                        </div>

                        {it.originalBlNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Réf BL : {it.originalBlNumber}
                          </div>
                        )}
                      </div>

                      <div className="text-right text-[11px] font-mono text-slate-400">
                        {it.recoveredViaScan ? (
                          <span className="text-blue-400">Scan</span>
                        ) : it.recoveredManually ? (
                          <span className="text-amber-400">Clavier</span>
                        ) : (
                          <span className="text-slate-500">En attente</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
