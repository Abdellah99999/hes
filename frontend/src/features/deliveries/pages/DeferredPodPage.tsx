import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  UploadCloud,
} from "lucide-react";

export const DeferredPodPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [trackingNumber, setTrackingNumber] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCin, setRecipientCin] = useState("");
  const [podPhotoStorageKey, setPodPhotoStorageKey] = useState("");
  const [agentNotes, setAgentNotes] = useState("");

  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      return customFetch(`/deliveries/${trackingNumber.trim()}/deferred-pod`, {
        method: "POST",
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          podPhotoStorageKey: podPhotoStorageKey.trim(),
          recipientCin: recipientCin.trim() || undefined,
          agentNotes: agentNotes.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-runs"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      setFeedbackMessage({
        type: "success",
        text: `Preuve de livraison (BL papier) enregistrée avec succès pour le colis ${trackingNumber.trim()}. Statut mis à jour à DELIVERED.`,
      });
      setTrackingNumber("");
      setRecipientName("");
      setRecipientCin("");
      setPodPhotoStorageKey("");
      setAgentNotes("");
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de l'enregistrement du BL papier.";
      setFeedbackMessage({
        type: "error",
        text: Array.isArray(msg) ? msg.join(", ") : String(msg),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim() || !recipientName.trim() || !podPhotoStorageKey.trim()) {
      setFeedbackMessage({
        type: "error",
        text: "Veuillez renseigner le numéro de colis, le nom du réceptionnaire et le fichier/clé du scan du BL.",
      });
      return;
    }
    setFeedbackMessage(null);
    mutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <FileCheck className="w-6 h-6" />
            </div>
            <span>Enregistrement Différé d'un Bon de Livraison Papier (BL)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Numérisez et validez les bordereaux physiques signés ou tamponnés rapportés par les livreurs au retour quai
          </p>
        </div>
      </div>

      {feedbackMessage && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-200"
              : "bg-rose-950/60 border-rose-800 text-rose-200"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-5 text-xs shadow-xl shadow-black/20"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Numéro de Tracking ou ID du Colis <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: HES-CAS-2026-000042-01"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nom ou Tampon du Réceptionnaire relevé sur le BL <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Société Maghreb Logistique (Cachet Direction)"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                CIN ou Matricule du Réceptionnaire
              </label>
              <input
                type="text"
                placeholder="Ex: BE998877"
                value={recipientCin}
                onChange={(e) => setRecipientCin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Fichier / Clé S3 de la Numérisation du BL Cacheté <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <UploadCloud className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: pod/scans/BL-20260903-HES-CAS-001.pdf"
                value={podPhotoStorageKey}
                onChange={(e) => setPodPhotoStorageKey(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Le bon de livraison physique scanné tient lieu de preuve juridique opposable au destinataire.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Observations de Conformité de l'Agent Quai (Optionnel)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Tampon lisible, date et signature manuscrite conformes"
              value={agentNotes}
              onChange={(e) => setAgentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{mutation.isPending ? "Validation du BL..." : "Enregistrer le BL Cacheté"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
