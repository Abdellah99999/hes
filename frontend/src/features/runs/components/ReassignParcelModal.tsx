import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  X,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";

interface DeliveryRunOption {
  id: string;
  runNumber: string;
  courierName: string;
  zoneName: string;
  shift: string;
  totalParcels: number;
}

interface ReassignParcelModalProps {
  isOpen: boolean;
  parcel: {
    id: string;
    trackingNumber: string;
    recipientAddress: string;
    recipientCity: string;
    weightKg: number;
    currentRunId?: string;
    currentRunNumber?: string;
  } | null;
  availableRuns: DeliveryRunOption[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReassignParcelModal: React.FC<ReassignParcelModalProps> = ({
  isOpen,
  parcel,
  availableRuns,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [targetRunId, setTargetRunId] = useState("");
  const [reason, setReason] = useState("");
  const [isOutOfZone, setIsOutOfZone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTargetRunId(availableRuns[0]?.id || "");
      setReason("");
      setIsOutOfZone(false);
      setErrorMessage(null);
    }
  }, [isOpen, availableRuns]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcel || !targetRunId) return;
      return customFetch("/runs/reassign", {
        method: "POST",
        body: JSON.stringify({
          parcelId: parcel.id,
          targetRunId,
          reason: reason.trim(),
          isOutOfZone,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-runs"] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de la réaffectation du colis.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  if (!isOpen || !parcel) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono">
                Réaffectation Manuelle Auditée
              </h2>
              <p className="text-[11px] text-slate-400">
                Colis : <span className="text-blue-400 font-bold">{parcel.trackingNumber}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason || reason.trim().length < 5) {
              setErrorMessage("Le motif obligatoire d'audit doit comporter au moins 5 caractères.");
              return;
            }
            mutation.mutate();
          }}
          className="p-6 space-y-4 text-xs"
        >
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parcel info recall */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">
              Adresse de destination
            </div>
            <div className="text-slate-200 font-medium">
              {parcel.recipientAddress}, {parcel.recipientCity}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
              <span>Poids : <strong className="text-slate-200">{parcel.weightKg} kg</strong></span>
              <span>Tournée actuelle : <strong className="text-blue-400">{parcel.currentRunNumber || "Non assigné"}</strong></span>
            </div>
          </div>

          {/* Target Run selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Sélectionner la Tournée Cible <span className="text-rose-400">*</span>
            </label>
            <select
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {availableRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.runNumber} — {r.courierName} ({r.zoneName} - {r.shift}) [{r.totalParcels} colis]
                </option>
              ))}
            </select>
          </div>

          {/* Out of zone checkbox */}
          <div className="flex items-center gap-2 p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-amber-200">
            <input
              type="checkbox"
              id="isOutOfZone"
              checked={isOutOfZone}
              onChange={(e) => setIsOutOfZone(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="isOutOfZone" className="text-[11px] cursor-pointer">
              Dérogation hors-zone principale (Zone non couverte par ce livreur)
            </label>
          </div>

          {/* Mandatory audit reason */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Motif de réaffectation obligatoire (Audit & Traçabilité) <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Demande client pour livraison l'après-midi, livreur habituel en surcharge..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Minimum 5 caractères. Ce motif est consigné de façon permanente dans les registres d'audit quai.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !targetRunId || reason.trim().length < 5}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-amber-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{mutation.isPending ? "Enregistrement..." : "Confirmer la réaffectation"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
