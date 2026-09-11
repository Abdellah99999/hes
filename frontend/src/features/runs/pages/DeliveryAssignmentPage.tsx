import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { ReassignParcelModal } from "../components/ReassignParcelModal";
import {
  Truck,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  MapPin,
  HelpCircle,
} from "lucide-react";

export interface RunItemDetail {
  id: string;
  sequenceOrder: number;
  status: string;
  isOutOfZone: boolean;
  parcel: {
    id: string;
    trackingNumber: string;
    weightKg: number;
    shipment: {
      recipientName: string;
      recipientAddress: string;
      recipientCity: string;
      codAmount: number | null;
    };
  };
}

export interface DeliveryRunDetail {
  id: string;
  runNumber: string;
  shift: string;
  runDate: string;
  status: string;
  totalParcels: number;
  totalWeightKg: number;
  totalCodToCollect: number;
  zone?: { id: string; code: string; name: string };
  courier: {
    id: string;
    vehicleType: string;
    maxCapacityKg: number;
    maxParcelsCapacity: number;
    user: { id: string; firstName: string; lastName: string; phone: string };
  };
  items: RunItemDetail[];
}

export const DeliveryAssignmentPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [runDate, setRunDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [shift, setShift] = useState("MORNING");
  const [selectedParcelForReassign, setSelectedParcelForReassign] = useState<{
    id: string;
    trackingNumber: string;
    recipientAddress: string;
    recipientCity: string;
    weightKg: number;
    currentRunId?: string;
    currentRunNumber?: string;
  } | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Fetch runs of current date and shift
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["delivery-runs", runDate, shift],
    queryFn: async () => {
      const params = new URLSearchParams({ runDate, shift });
      return customFetch<{ data: DeliveryRunDetail[]; meta: { total: number } }>(
        `/runs?${params.toString()}`,
      );
    },
  });

  const runs = data?.data || [];

  // Trigger Auto-Assign Algorithm
  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      return customFetch<{
        assignedParcelsCount: number;
        unzonedParcelsCount: number;
        createdRunsCount: number;
        unzonedParcels: { parcelId: string; trackingNumber: string }[];
      }>("/runs/auto-assign", {
        method: "POST",
        body: JSON.stringify({ runDate, shift }),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-runs"] });
      let text = `Affectation automatique réussie : ${res.assignedParcelsCount} colis affectés (${res.createdRunsCount} tournées générées).`;
      if (res.unzonedParcelsCount > 0) {
        text += ` Attention : ${res.unzonedParcelsCount} colis sans zone correspondante nécessitent une affectation manuelle.`;
      }
      setFeedbackMessage({
        type: res.unzonedParcelsCount > 0 ? "info" : "success",
        text,
      });
      refetch();
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de l'exécution de l'algorithme d'affectation.";
      setFeedbackMessage({
        type: "error",
        text: Array.isArray(msg) ? msg.join(", ") : String(msg),
      });
    },
  });

  const availableRunsOptions = runs.map((r) => ({
    id: r.id,
    runNumber: r.runNumber,
    courierName: `${r.courier.user.firstName} ${r.courier.user.lastName}`,
    zoneName: r.zone?.name || "Hors-Zone",
    shift: r.shift,
    totalParcels: r.totalParcels,
  }));

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <span>Affectation des Livraisons & Tournées (Hub Quai)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Génération automatique adresse &rarr; zone &rarr; livreur et réaffectations manuelles auditées
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none font-mono text-xs"
            />
          </div>

          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="MORNING">Matin (08:30 - 13:00)</option>
            <option value="AFTERNOON">Après-midi (14:00 - 19:00)</option>
            <option value="EVENING">Soir / Express</option>
            <option value="CUSTOM">Dérogatoire / Exceptionnel</option>
          </select>

          <button
            onClick={() => autoAssignMutation.mutate()}
            disabled={autoAssignMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {autoAssignMutation.isPending
                ? "Calcul de l'affectation..."
                : "Lancer Affectation Auto"}
            </span>
          </button>
        </div>
      </div>

      {/* Feedback message banner */}
      {feedbackMessage && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-200"
              : feedbackMessage.type === "info"
                ? "bg-amber-950/60 border-amber-800 text-amber-200"
                : "bg-rose-950/60 border-rose-800 text-rose-200"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : feedbackMessage.type === "info" ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Runs List */}
      {isLoading && (
        <div className="p-12 text-center text-slate-500 text-xs">
          Chargement des tournées de l'agence...
        </div>
      )}

      {!isLoading && runs.length === 0 && (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-3">
          <Truck className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-300">Aucune tournée pour ce créneau</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cliquez sur "Lancer Affectation Auto" pour affecter automatiquement les colis du stock quai aux livreurs disponibles selon leur zone géographique.
          </p>
        </div>
      )}

      {!isLoading && runs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {runs.map((run) => (
            <div
              key={run.id}
              className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4 shadow-xl shadow-black/20"
            >
              {/* Header card */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-400 text-sm">
                      {run.runNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium text-[10px]">
                      {run.shift}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    Zone : <strong className="text-slate-200">{run.zone?.name || "Multi-Zones"}</strong>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-200 block">
                    {run.courier.user.firstName} {run.courier.user.lastName}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {run.courier.user.phone} ({run.courier.vehicleType})
                  </span>
                </div>
              </div>

              {/* KPIs indicators */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 text-[10px] block">Colis</span>
                  <span className="font-mono font-bold text-slate-200">
                    {run.totalParcels} / {run.courier.maxParcelsCapacity}
                  </span>
                </div>
                <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 text-[10px] block">Poids total</span>
                  <span className="font-mono font-bold text-slate-200">
                    {run.totalWeightKg.toFixed(1)} kg
                  </span>
                </div>
                <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 text-[10px] block">COD à encaisser</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {Number(run.totalCodToCollect || 0).toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* Items in this run */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-1">
                  Ordre de passage & Colis ({run.items.length})
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {run.items.map((it) => (
                    <div
                      key={it.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        it.isOutOfZone
                          ? "bg-amber-950/20 border-amber-900/50"
                          : "bg-slate-950/40 border-slate-850 hover:border-slate-750"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 font-bold">
                            #{it.sequenceOrder}
                          </span>
                          <span className="font-mono font-bold text-slate-200">
                            {it.parcel.trackingNumber}
                          </span>
                          {it.isOutOfZone && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[9px] font-semibold flex items-center gap-1">
                              <HelpCircle className="w-2.5 h-2.5" />
                              <span>Hors-Zone</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate max-w-xs">
                            {it.parcel.shipment.recipientAddress}, {it.parcel.shipment.recipientCity}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {it.parcel.weightKg} kg
                        </span>
                        <button
                          title="Réaffecter manuellement ce colis (audit)"
                          onClick={() =>
                            setSelectedParcelForReassign({
                              id: it.parcel.id,
                              trackingNumber: it.parcel.trackingNumber,
                              recipientAddress: it.parcel.shipment.recipientAddress,
                              recipientCity: it.parcel.shipment.recipientCity,
                              weightKg: it.parcel.weightKg,
                              currentRunId: run.id,
                              currentRunNumber: run.runNumber,
                            })
                          }
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reassign Modal */}
      <ReassignParcelModal
        isOpen={!!selectedParcelForReassign}
        parcel={selectedParcelForReassign}
        availableRuns={availableRunsOptions}
        onClose={() => setSelectedParcelForReassign(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
