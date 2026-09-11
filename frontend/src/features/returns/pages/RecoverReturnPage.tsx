import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Keyboard,
  ShieldAlert,
  Search,
} from "lucide-react";

export const RecoverReturnPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [inputMode, setInputMode] = useState<"SCAN" | "MANUAL">("MANUAL");
  const [identifier, setIdentifier] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      return customFetch<{
        returnItem: { id: string; originalTrackingNumber: string };
        trackingNumber: string;
        recoveredVia: string;
      }>("/returns/recover", {
        method: "POST",
        body: JSON.stringify({
          identifier: identifier.trim(),
          isScan: inputMode === "SCAN",
          isFallbackEmergency: isEmergency,
          emergencyReason: isEmergency ? emergencyReason.trim() : undefined,
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["my-runs"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      setFeedback({
        type: "success",
        text: `Colis ${data.trackingNumber} récupéré avec succès (${data.recoveredVia === "SCAN" ? "par scan code-barres" : "par saisie manuelle du BL"}). Statut mis à jour à RECOVERED.`,
      });
      setIdentifier("");
      setIsEmergency(false);
      setEmergencyReason("");
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de la récupération du colis retour.";
      setFeedback({
        type: "error",
        text: Array.isArray(msg) ? msg.join(", ") : String(msg),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setFeedback({
        type: "error",
        text: "Veuillez scanner ou saisir le numéro de BL ou de tracking.",
      });
      return;
    }
    if (isEmergency && emergencyReason.trim().length < 5) {
      setFeedback({
        type: "error",
        text: "La procédure d'urgence requiert un motif explicite d'au moins 5 caractères.",
      });
      return;
    }
    setFeedback(null);
    mutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/10 text-rose-400 border border-rose-500/20 rounded-xl">
              <RotateCcw className="w-6 h-6" />
            </div>
            <span>Récupérer un Colis Retour (Livreur)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enregistrement physique des colis refusés ou à rapatrier (par scan physique ou saisie clavier du BL)
          </p>
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-200"
              : "bg-rose-950/60 border-rose-800 text-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Mode selection: Scan vs Keyboard manual input */}
      <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-2xl grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          onClick={() => setInputMode("SCAN")}
          className={`py-2 px-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
            inputMode === "SCAN"
              ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Mode Scan Caméra / Douchette</span>
        </button>

        <button
          type="button"
          onClick={() => setInputMode("MANUAL")}
          className={`py-2 px-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
            inputMode === "MANUAL"
              ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span>Saisie Manuelle Numéro BL</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-5 text-xs shadow-xl shadow-black/20"
      >
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            {inputMode === "SCAN"
              ? "Code-barres / QR Code scanné"
              : "Numéro de Bon de Livraison (BL) ou Numéro de Tracking"}{" "}
            <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                inputMode === "SCAN"
                  ? "Pointez la douchette vers l'étiquette..."
                  : "Ex: BL-TNG-2026-001 ou HES-CAS-2026-000100-01"
              }
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            Recherche immédiate par code-barres BL, référence tracking ou identifiant colis.
          </span>
        </div>

        {/* Emergency fallback toggle */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-xs">
                Procédure de Secours (BL physique perdu / totalement illisible)
              </span>
            </div>
            <input
              type="checkbox"
              id="emergencyToggle"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-amber-600 focus:ring-amber-500"
            />
          </div>

          {isEmergency && (
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <p className="text-[10px] text-amber-400/90">
                Activez ce mode exceptionnel uniquement si l'étiquette et le BL sont détruits ou absents. Un motif circonstancié est consigné pour le superviseur quai.
              </p>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Motif circonstancié de la procédure d'urgence <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Étiquette arrachée, colis identifié par facture intérieure et concordance téléphone client"
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-amber-900/60 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md shadow-rose-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{mutation.isPending ? "Validation..." : "Confirmer la Récupération du Retour"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
