import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  Search,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

export const ReportIncidentPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [shipmentIdentifier, setShipmentIdentifier] = useState("");
  const [parcelIdentifier, setParcelIdentifier] = useState("");
  const [type, setType] = useState<
    "LOSS" | "DAMAGE" | "THEFT" | "DELIVERY_DISPUTE" | "OTHER"
  >("DAMAGE");
  const [severity, setSeverity] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  >("MEDIUM");
  const [description, setDescription] = useState("");
  const [claimedValue, setClaimedValue] = useState<number | "">("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      return customFetch<{
        incident: { id: string; incidentNumber: string; isDeliveredDispute: boolean };
        lastKnownTrackingContext: { status: string | null; agencyCode: string | null };
        isDeliveredDispute: boolean;
      }>("/incidents", {
        method: "POST",
        body: JSON.stringify({
          shipmentIdentifier: shipmentIdentifier.trim(),
          parcelIdentifier: parcelIdentifier.trim() || undefined,
          type,
          severity,
          description: description.trim(),
          declaredValueClaimed:
            claimedValue !== "" && Number(claimedValue) > 0
              ? Number(claimedValue)
              : undefined,
        }),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      let text = `Incident ${res.incident.incidentNumber} déclaré avec succès (Rattaché au contexte: ${res.lastKnownTrackingContext.status || "Inconnu"}).`;
      if (res.isDeliveredDispute) {
        text +=
          " ATTENTION : Ce colis était marqué DELIVERED. Une vérification de la signature/POD a été initiée.";
      }
      setFeedback({
        type: res.isDeliveredDispute ? "warning" : "success",
        text,
      });
      setShipmentIdentifier("");
      setParcelIdentifier("");
      setDescription("");
      setClaimedValue("");
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de l'enregistrement de l'incident.";
      setFeedback({
        type: "error",
        text: Array.isArray(msg) ? msg.join(", ") : String(msg),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentIdentifier.trim()) {
      setFeedback({
        type: "error",
        text: "Veuillez renseigner le numéro de tracking ou l'identifiant de l'expédition.",
      });
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      setFeedback({
        type: "error",
        text: "La description des faits doit comporter au moins 5 caractères.",
      });
      return;
    }
    setFeedback(null);
    mutation.mutate();
  };

  const isCustomer = user?.role === "CUSTOMER";
  const isCourier = user?.role === "COURIER";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/10 text-rose-400 border border-rose-500/20 rounded-xl">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <span>
              {isCustomer
                ? "Déclarer une Réclamation / Litige"
                : isCourier
                  ? "Signaler une Anomalie Colis (Livreur)"
                  : "Déclaration d'Incident Logistique"}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Déclaration formelle d'avarie, vol, perte ou contestation de livraison avec snapshot immuable de traçabilité
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Rôle : {user?.role}</span>
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-200"
              : feedback.type === "warning"
                ? "bg-amber-950/60 border-amber-800 text-amber-200"
                : "bg-rose-950/60 border-rose-800 text-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : feedback.type === "warning" ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-5 text-xs shadow-xl shadow-black/20"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Numéro de Tracking Expédition <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: HES-CAS-2026-000500"
                value={shipmentIdentifier}
                onChange={(e) => setShipmentIdentifier(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {!isCustomer && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Numéro Colis / Code-barres spécifique (Optionnel si mono-colis)
              </label>
              <input
                type="text"
                placeholder="Ex: HES-CAS-2026-000500-01"
                value={parcelIdentifier}
                onChange={(e) => setParcelIdentifier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Type d'anomalie <span className="text-rose-400">*</span>
              </label>
              <select
                aria-label="Type d'anomalie"
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value as
                      | "LOSS"
                      | "DAMAGE"
                      | "THEFT"
                      | "DELIVERY_DISPUTE"
                      | "OTHER",
                  )
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="DAMAGE">Avarie / Détérioration / Casse</option>
                <option value="LOSS">Perte constatée</option>
                <option value="THEFT">Vol / Suspicion d'effraction</option>
                <option value="DELIVERY_DISPUTE">Contestation de livraison (Non reçu)</option>
                <option value="OTHER">Autre incident</option>
              </select>
            </div>

            {!isCustomer && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gravité opérationnelle
                </label>
                <select
                  value={severity}
                  onChange={(e) =>
                    setSeverity(
                      e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="LOW">Faible (retard / emballage superficiel)</option>
                  <option value="MEDIUM">Moyenne (casse partielle)</option>
                  <option value="HIGH">Élevée (perte totale)</option>
                  <option value="CRITICAL">Critique (vol / litige juridique)</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description factuelle des faits constatés <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Précisez l'état du carton, les déclarations du client ou les circonstances de l'anomalie..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Montant du préjudice réclamé en MAD (Optionnel)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 850.00"
                value={claimedValue}
                onChange={(e) =>
                  setClaimedValue(
                    e.target.value === "" ? "" : parseFloat(e.target.value),
                  )
                }
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              L'indemnisation fait obligatoirement l'objet d'une décision d'enquête délibérée par la direction.
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md shadow-rose-500/20"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>{mutation.isPending ? "Enregistrement..." : "Enregistrer la Déclaration"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
