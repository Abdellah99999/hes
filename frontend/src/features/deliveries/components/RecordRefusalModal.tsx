import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  X,
  AlertTriangle,
  Ban,
  RotateCcw,
} from "lucide-react";

export const REFUSAL_REASONS_CATALOG = [
  { code: "DAMAGED_PACKAGE", label: "Colis détérioré / emballage endommagé" },
  { code: "CONTENT_MISMATCH", label: "Contenu non conforme à la commande" },
  { code: "COD_AMOUNT_DISPUTED", label: "Montant COD contesté par le destinataire" },
  { code: "ORDER_CANCELLED", label: "Commande préalablement annulée par l'acheteur" },
  { code: "REFUSED_WITHOUT_REASON", label: "Refus pur et simple sans justification" },
  { code: "FRAUD_SUSPECTED", label: "Suspicion de fraude ou faux destinataire" },
] as const;

export type ValidatedRefusalCode = (typeof REFUSAL_REASONS_CATALOG)[number]["code"];

interface RecordRefusalModalProps {
  isOpen: boolean;
  parcel: {
    id: string;
    trackingNumber: string;
    recipientName: string;
    recipientAddress: string;
    recipientCity: string;
    codAmount: number | null;
  } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RecordRefusalModal: React.FC<RecordRefusalModalProps> = ({
  isOpen,
  parcel,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [reasonCode, setReasonCode] = useState<ValidatedRefusalCode>(
    REFUSAL_REASONS_CATALOG[0].code,
  );
  const [courierNotes, setCourierNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setReasonCode(REFUSAL_REASONS_CATALOG[0].code);
      setCourierNotes("");
      setErrorMessage(null);
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcel) return;
      return customFetch(`/deliveries/${parcel.id}/refuse`, {
        method: "POST",
        body: JSON.stringify({
          reasonCode,
          courierNotes: courierNotes.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-runs"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-runs"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
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
        "Erreur lors de l'enregistrement du refus.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  if (!isOpen || !parcel) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono">
                Signaler un Refus Destinataire
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

          {/* Warning banner */}
          <div className="p-3 bg-rose-950/20 border border-rose-900/50 rounded-xl text-rose-300 text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-400">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Déclenchement automatique du retour à l'expéditeur</span>
            </div>
            <p className="text-slate-400 text-[10px]">
              L'enregistrement d'un refus fait passer immédiatement le colis au statut <strong>RETURNED</strong>. Le colis devra être rapporté au quai pour expédition vers l'agence d'origine.
            </p>
          </div>

          {/* Strictly validated reason selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Motif Officiel du Refus <span className="text-rose-400">*</span>
            </label>
            <select
              aria-label="Motif Officiel du Refus"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ValidatedRefusalCode)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
            >
              {REFUSAL_REASONS_CATALOG.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 block mt-1">
              Strictement limité au référentiel validé (aucun champ libre autorisé pour la cause légale).
            </span>
          </div>

          {/* Optional courier notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Remarques complémentaires du livreur (Optionnel)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Le destinataire a ouvert devant moi et constaté le flacon brisé..."
              value={courierNotes}
              onChange={(e) => setCourierNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500"
            />
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
              disabled={mutation.isPending}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-rose-500/20"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{mutation.isPending ? "Enregistrement..." : "Confirmer le Refus & Retour"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
