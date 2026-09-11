import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  AlertOctagon,
  Search,
  Calendar,
  AlertTriangle,
  Gavel,
} from "lucide-react";

export interface IncidentHistoryDetail {
  id: string;
  action: string;
  previousStatus: string;
  newStatus: string;
  comment: string;
  awardedAmount: number | null;
  evidenceUrl: string | null;
  createdAt: string;
  performedBy: { id: string; firstName: string; lastName: string };
}

export interface IncidentDetail {
  id: string;
  incidentNumber: string;
  type: string;
  severity: string;
  status: string;
  isDeliveredDispute: boolean;
  description: string;
  declaredValueClaimed: number | null;
  compensationAmount: number | null;
  createdAt: string;
  declaredByUser: { id: string; firstName: string; lastName: string; email: string };
  shipment: {
    id: string;
    trackingNumber: string;
    recipientName: string;
    recipientCity: string;
    originAgency?: { code: string; name: string };
    destinationAgency?: { code: string; name: string };
  };
  parcel?: { id: string; trackingNumber: string; weightKg: number; status: string } | null;
  lastTrackingEvent?: { id: string; status: string; source: string; createdAt: string } | null;
  history: IncidentHistoryDetail[];
}

export const IncidentsManagementPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null);

  // Decision state
  const [decisionAction, setDecisionAction] = useState<
    "OPEN_INVESTIGATION" | "REQUEST_ADDITIONAL_INFO" | "APPROVE_COMPENSATION" | "REJECT_CLAIM" | "CLOSE_WITHOUT_ACTION"
  >("OPEN_INVESTIGATION");
  const [decisionComment, setDecisionComment] = useState("");
  const [awardedAmount, setAwardedAmount] = useState<number | "">("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);
      return customFetch<{ data: IncidentDetail[]; meta: { total: number } }>(
        `/incidents?${params.toString()}`,
      );
    },
  });

  const incidents = data?.data || [];

  const decisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIncident) return;
      return customFetch(`/incidents/${selectedIncident.id}/decide`, {
        method: "POST",
        body: JSON.stringify({
          action: decisionAction,
          comment: decisionComment.trim(),
          awardedAmount:
            decisionAction === "APPROVE_COMPENSATION" && awardedAmount !== ""
              ? Number(awardedAmount)
              : undefined,
          evidenceUrl: evidenceUrl.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setSelectedIncident(null);
      setDecisionComment("");
      setAwardedAmount("");
      setEvidenceUrl("");
      setDecisionError(null);
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de l'enregistrement de la décision.";
      setDecisionError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/10 text-rose-400 border border-rose-500/20 rounded-xl">
              <Gavel className="w-6 h-6" />
            </div>
            <span>Gestion des Incidents & Décisions d'Enquête</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Instruction des réclamations, historique des expertises et validation délibérée des indemnisations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher INC- ou HES-..."
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
            <option value="REPORTED">Signalé (En attente)</option>
            <option value="INVESTIGATING">En cours d'enquête</option>
            <option value="COMPENSATED">Indemnisé</option>
            <option value="RESOLVED">Résolu (Sans indemnité)</option>
            <option value="REJECTED">Rejeté</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-slate-500 text-xs">
          Chargement des dossiers d'incidents...
        </div>
      )}

      {!isLoading && incidents.length === 0 && (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-3">
          <AlertOctagon className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-200">Aucun incident répertorié</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tous les colis cheminent normalement sans litige ni avarie déclarée.
          </p>
        </div>
      )}

      {!isLoading && incidents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incidents List (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-lg ${
                  selectedIncident?.id === inc.id
                    ? "bg-slate-900 border-rose-500 ring-1 ring-rose-500/50"
                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-rose-400 text-sm">
                        {inc.incidentNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                        {inc.type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          inc.status === "COMPENSATED"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : inc.status === "REJECTED"
                              ? "bg-slate-800 text-slate-400"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                        }`}
                      >
                        {inc.status}
                      </span>

                      {inc.isDeliveredDispute && (
                        <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 text-[9px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Litige Post-Livraison (Vérif POD)</span>
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 block mt-1">
                      Expédition : <strong className="text-slate-200 font-mono">{inc.shipment.trackingNumber}</strong>
                    </span>
                  </div>

                  <div className="text-right text-[11px] text-slate-400">
                    <div className="flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{new Date(inc.createdAt).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <span className="text-slate-500 block">
                      Par : {inc.declaredByUser.firstName} {inc.declaredByUser.lastName}
                    </span>
                  </div>
                </div>

                <div className="pt-3 text-xs text-slate-300">
                  <p className="line-clamp-2 text-slate-400 italic">
                    "{inc.description}"
                  </p>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80 text-[11px]">
                    <div className="text-slate-400">
                      Dernier statut tracking au constat :{" "}
                      <strong className="text-blue-400 font-mono">
                        {inc.lastTrackingEvent?.status || "Non renseigné"}
                      </strong>
                    </div>

                    {inc.compensationAmount && Number(inc.compensationAmount) > 0 ? (
                      <span className="font-mono font-bold text-emerald-400">
                        Indemnisé : {Number(inc.compensationAmount).toFixed(2)} MAD
                      </span>
                    ) : inc.declaredValueClaimed ? (
                      <span className="font-mono text-slate-400">
                        Réclamé : {Number(inc.declaredValueClaimed).toFixed(2)} MAD
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Incident Detail & Decision Panel (Right col) */}
          <div className="space-y-5">
            {selectedIncident ? (
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-5 text-xs shadow-xl">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-rose-400" />
                    <span>Instruction : {selectedIncident.incidentNumber}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {selectedIncident.type} &bull; Gravité : {selectedIncident.severity}
                  </span>
                </div>

                {selectedIncident.isDeliveredDispute && (
                  <div className="p-3 bg-amber-950/40 border border-amber-800 text-amber-200 rounded-xl text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Attention : Contestation de livraison</span>
                    </div>
                    <p className="text-[10px] text-amber-300/80">
                      Le colis était certifié DELIVERED avec preuve POD. Vérifiez la signature tactile ou le BL tamponné avant toute décision.
                    </p>
                  </div>
                )}

                {/* Decision Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!decisionComment.trim()) {
                      setDecisionError("Un commentaire d'instruction motivé est obligatoire.");
                      return;
                    }
                    if (
                      decisionAction === "APPROVE_COMPENSATION" &&
                      (!awardedAmount || Number(awardedAmount) <= 0)
                    ) {
                      setDecisionError("Le montant alloué doit être supérieur à zéro pour indemniser.");
                      return;
                    }
                    setDecisionError(null);
                    decisionMutation.mutate();
                  }}
                  className="space-y-3 pt-2"
                >
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Statuer / Ajouter une décision
                  </div>

                  {decisionError && (
                    <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-[11px]">
                      {decisionError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Action formelle
                    </label>
                    <select
                      value={decisionAction}
                      onChange={(e) =>
                        setDecisionAction(
                          e.target.value as
                            | "OPEN_INVESTIGATION"
                            | "REQUEST_ADDITIONAL_INFO"
                            | "APPROVE_COMPENSATION"
                            | "REJECT_CLAIM"
                            | "CLOSE_WITHOUT_ACTION",
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value="OPEN_INVESTIGATION">Ouvrir l'enquête formelle</option>
                      <option value="REQUEST_ADDITIONAL_INFO">Demander des pièces justificatives</option>
                      <option value="APPROVE_COMPENSATION">Approuver l'indemnisation (Décision finale)</option>
                      <option value="REJECT_CLAIM">Rejeter la réclamation</option>
                      <option value="CLOSE_WITHOUT_ACTION">Clôturer sans suite</option>
                    </select>
                  </div>

                  {decisionAction === "APPROVE_COMPENSATION" && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Montant accordé en MAD <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Ex: 500.00"
                        value={awardedAmount}
                        onChange={(e) =>
                          setAwardedAmount(
                            e.target.value === "" ? "" : parseFloat(e.target.value),
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-emerald-800 rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Commentaire d'instruction motivé <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Indiquez les conclusions de l'enquête ou les motifs de la décision..."
                      value={decisionComment}
                      onChange={(e) => setDecisionComment(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={decisionMutation.isPending}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-rose-500/20"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>{decisionMutation.isPending ? "Validation..." : "Valider la Décision"}</span>
                  </button>
                </form>

                {/* History timeline */}
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Historique de l'Enquête ({selectedIncident.history.length})
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedIncident.history.map((h) => (
                      <div
                        key={h.id}
                        className="p-2.5 bg-slate-950/50 border border-slate-850 rounded-xl text-[11px] space-y-1"
                      >
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-semibold text-rose-300">{h.action}</span>
                          <span className="text-[10px]">
                            {new Date(h.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        <p className="text-slate-300 italic">"{h.comment}"</p>
                        <div className="text-[10px] text-slate-500">
                          Par : {h.performedBy.firstName} {h.performedBy.lastName}
                          {h.awardedAmount && (
                            <span className="text-emerald-400 font-bold ml-2">
                              &bull; {Number(h.awardedAmount).toFixed(2)} MAD
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                Sélectionnez un incident pour afficher les détails, consulter l'historique d'enquête et statuer formellement.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
