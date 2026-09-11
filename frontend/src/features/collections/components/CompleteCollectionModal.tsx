import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
} from "lucide-react";

export interface CollectionItemDetail {
  id: string;
  itemIndex: number;
  declaredWeightKg: number | null;
  description: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  codAmount: number | null;
}

export interface CollectionDetail {
  id: string;
  collectionNumber: string;
  pickupContactName: string;
  pickupPhone: string;
  pickupStreet: string;
  pickupCity: string;
  scheduledDate: string;
  status: string;
  customer?: { legalName: string; code: string };
  items: CollectionItemDetail[];
}

interface CompleteCollectionModalProps {
  isOpen: boolean;
  collection: CollectionDetail | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CompleteCollectionModal: React.FC<CompleteCollectionModalProps> = ({
  isOpen,
  collection,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [actualWeights, setActualWeights] = useState<Record<number, number>>({});
  const [driverNotes, setDriverNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedShipment, setGeneratedShipment] = useState<{
    trackingNumber: string;
    totalParcels: number;
    totalWeightKg: number;
  } | null>(null);

  React.useEffect(() => {
    if (isOpen && collection) {
      const initial: Record<number, number> = {};
      collection.items.forEach((item) => {
        initial[item.itemIndex] = item.declaredWeightKg || 1.0;
      });
      setActualWeights(initial);
      setDriverNotes("");
      setErrorMessage(null);
      setGeneratedShipment(null);
    }
  }, [isOpen, collection]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!collection) return;
      const itemsPayload = collection.items.map((item) => ({
        itemIndex: item.itemIndex,
        actualWeightKg: Number(actualWeights[item.itemIndex] || 1.0),
        recipientName: item.recipientName,
        recipientPhone: item.recipientPhone,
        recipientAddress: item.recipientAddress,
        recipientCity: item.recipientCity,
        codAmount: item.codAmount ?? undefined,
      }));

      return customFetch<{
        shipment: { trackingNumber: string; totalParcels: number; totalWeightKg: number };
      }>(`/collections/${collection.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          driverNotes: driverNotes.trim() || undefined,
          items: itemsPayload,
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["courier-missions"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      if (data?.shipment) {
        setGeneratedShipment(data.shipment);
      }
      if (onSuccess) onSuccess();
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de la clôture de l'enlèvement.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  if (!isOpen || !collection) return null;

  const totalActualWeight = Object.values(actualWeights).reduce(
    (sum, w) => sum + (Number(w) || 0),
    0,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono">
                Complétion Enlèvement {collection.collectionNumber}
              </h2>
              <p className="text-xs text-slate-400">
                Client : {collection.customer?.legalName} — {collection.pickupContactName} ({collection.pickupPhone})
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

        {/* Success view if shipment was generated */}
        {generatedShipment ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Enlèvement Réalisé & Expédition Générée !
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                La prise en charge physique a été validée avec succès.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl inline-block text-left text-xs space-y-2">
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-400">N° Expédition :</span>
                <span className="font-mono font-bold text-blue-400 text-sm">
                  {generatedShipment.trackingNumber}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-400">Colis créés :</span>
                <span className="font-mono font-bold text-slate-200">
                  {generatedShipment.totalParcels} colis
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-400">Poids total pesé :</span>
                <span className="font-mono font-bold text-slate-200">
                  {generatedShipment.totalWeightKg.toFixed(1)} kg
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
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

            {/* Address recall */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                Adresse d'enlèvement
              </span>
              <span>{collection.pickupStreet}, {collection.pickupCity}</span>
            </div>

            {/* Parcels actual weights input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-400 font-medium px-1">
                <span>Pesée Réelle des Colis Collectés ({collection.items.length})</span>
                <span className="font-mono text-slate-200 font-bold">
                  Total : {totalActualWeight.toFixed(1)} kg
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {collection.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-200 block text-xs">
                        Colis #{item.itemIndex} — {item.recipientName} ({item.recipientCity})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Déclaré : {item.declaredWeightKg || 1} kg
                        {item.codAmount ? ` | COD: ${item.codAmount} MAD` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-400">Poids réel :</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={actualWeights[item.itemIndex] ?? 1.0}
                        onChange={(e) =>
                          setActualWeights({
                            ...actualWeights,
                            [item.itemIndex]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 text-right focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-400 font-mono text-xs">kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver remarks */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Observations Coursier / Remarques Terrain
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Emballage intact, client présent, signature reçue"
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
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
                disabled={mutation.isPending || totalActualWeight <= 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {mutation.isPending
                    ? "Génération de l'expédition..."
                    : "Valider l'enlèvement & Créer l'expédition"}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
