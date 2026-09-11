import React from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  manualStatusChangeSchema,
  ManualStatusChangeFormData,
} from "../schemas/tracking.schema";
import { ParcelStatus } from "../schemas/shipment.schema";
import {
  X,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

interface ManualStatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTrackingNumber?: string;
  currentStatus?: ParcelStatus;
  onSuccess?: () => void;
}

export const ManualStatusChangeModal: React.FC<ManualStatusChangeModalProps> = ({
  isOpen,
  onClose,
  defaultTrackingNumber = "",
  currentStatus,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManualStatusChangeFormData>({
    resolver: zodResolver(manualStatusChangeSchema) as unknown as Resolver<ManualStatusChangeFormData>,
    defaultValues: {
      trackingNumberOrId: defaultTrackingNumber,
      status: "PICKED_UP",
      notes: "",
    },
  });

  const notesValue = watch("notes") || "";

  React.useEffect(() => {
    if (isOpen) {
      reset({
        trackingNumberOrId: defaultTrackingNumber,
        status: currentStatus === "REGISTERED" ? "PICKED_UP" : "IN_TRANSIT",
        notes: "",
      });
      setErrorMessage(null);
    }
  }, [isOpen, defaultTrackingNumber, currentStatus, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ManualStatusChangeFormData) => {
      return customFetch("/shipments/track/manual", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
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
        "Erreur lors de la mise à jour manuelle du statut.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  const onSubmit = (data: ManualStatusChangeFormData) => {
    setErrorMessage(null);
    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Changement de Statut Manuel (Audité)
              </h2>
              <p className="text-xs text-slate-400">
                Source MANUAL avec commentaire obligatoire et journalisation de sécurité
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Alert Note */}
        <div className="px-6 pt-4">
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-300 text-[11px] flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Audit de Sécurité Obligatoire</span>
              Toute modification manuelle est nominativement liée à votre compte opérateur et horodatée dans le journal d'audit immuable.
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="px-6 pt-3">
            <div
              role="alert"
              className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Numéro de Tracking Colis <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: HES-CAS-2026-000001-01"
              {...register("trackingNumberOrId")}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
            {errors.trackingNumberOrId && (
              <span className="text-[11px] text-rose-400 mt-1 block">
                {errors.trackingNumberOrId.message}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nouveau Statut Cible <span className="text-rose-400">*</span>
            </label>
            <select
              {...register("status")}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            >
              <option value="PICKED_UP">Prise en charge (PICKED_UP)</option>
              <option value="IN_TRANSIT">En cours de transfert (IN_TRANSIT)</option>
              <option value="AT_HUB">Au Hub de Tri (AT_HUB)</option>
              <option value="OUT_FOR_DELIVERY">En Tournée de livraison (OUT_FOR_DELIVERY)</option>
              <option value="DELIVERED">Livré au destinataire (DELIVERED)</option>
              <option value="DELIVERY_FAILED">Échec de distribution (DELIVERY_FAILED)</option>
              <option value="RETURNED">Retourné expéditeur (RETURNED)</option>
              <option value="LOST">Déclaré Perdu (LOST)</option>
              <option value="DAMAGED">Déclaré Endommagé (DAMAGED)</option>
              <option value="CANCELLED">Annulé (CANCELLED)</option>
            </select>
            {errors.status && (
              <span className="text-[11px] text-rose-400 mt-1 block">
                {errors.status.message}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Motif Obligatoire de la Saisie Manuelle <span className="text-rose-400">*</span>
              </label>
              <span
                className={`text-[10px] font-mono ${
                  notesValue.length >= 5 ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                {notesValue.length} / 5 car. min
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="Justifiez obligatoirement ce changement manuel (ex: Code-barres endommagé lors du tri quai Tanger, confirmation client par appel...)"
              {...register("notes")}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
            {errors.notes && (
              <span className="text-[11px] text-rose-400 mt-1 block">
                {errors.notes.message}
              </span>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-purple-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isSubmitting || mutation.isPending
                  ? "Enregistrement audité..."
                  : "Valider le statut"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
