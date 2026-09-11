import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  X,
  Truck,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Agency {
  id: string;
  code: string;
  name: string;
}

interface StockParcel {
  id: string;
  trackingNumber: string;
  weightKg: number;
  status: string;
  shipment?: {
    trackingNumber: string;
    recipientName: string;
    recipientCity: string;
  };
}

interface TransferPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TransferPrepModal: React.FC<TransferPrepModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [destinationAgencyId, setDestinationAgencyId] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch all agencies for destination select
  const { data: agenciesData } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => customFetch<{ data: Agency[] }>("/agencies?limit=100"),
    enabled: isOpen,
  });

  const agencies = agenciesData?.data || [];
  const currentAgencyId = user?.agencyId || (agencies.length > 0 ? agencies[0].id : "");

  // Fetch stock parcels in current origin agency
  const { data: stockData, isLoading: isStockLoading } = useQuery({
    queryKey: ["agency-stock", currentAgencyId],
    queryFn: async () => {
      if (!currentAgencyId) return { data: [] };
      return customFetch<{ data: StockParcel[] }>(`/agencies/${currentAgencyId}/stock?limit=100`);
    },
    enabled: isOpen && !!currentAgencyId,
  });

  const availableParcels = stockData?.data || [];

  const toggleSelectParcel = (id: string) => {
    const next = new Set(selectedParcelIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedParcelIds(next);
  };

  const handleSelectAll = () => {
    const all = new Set(availableParcels.map((p) => p.id));
    setSelectedParcelIds(all);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      return customFetch("/transfers", {
        method: "POST",
        body: JSON.stringify({
          originAgencyId: currentAgencyId,
          destinationAgencyId,
          vehiclePlate: vehiclePlate.trim() || undefined,
          driverName: driverName.trim() || undefined,
          driverPhone: driverPhone.trim() || undefined,
          sealNumber: sealNumber.trim() || undefined,
          parcelIds: Array.from(selectedParcelIds),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["agency-stock"] });
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
        "Erreur lors de la préparation du transfert.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationAgencyId) {
      setErrorMessage("Veuillez sélectionner l'agence de destination.");
      return;
    }
    if (selectedParcelIds.size === 0) {
      setErrorMessage("Veuillez sélectionner au moins un colis à inclure dans le transfert.");
      return;
    }
    setErrorMessage(null);
    createMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Préparer un Transfert Inter-Agences
              </h2>
              <p className="text-xs text-slate-400">
                Chargement physique et groupage des colis quai par destination
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

        {errorMessage && (
          <div className="px-6 pt-4">
            <div
              role="alert"
              className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Agence Destination <span className="text-rose-400">*</span>
              </label>
              <select
                value={destinationAgencyId}
                onChange={(e) => setDestinationAgencyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Choisir l'agence suivante --</option>
                {agencies
                  .filter((a) => a.id !== currentAgencyId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Numéro de Scellé Remorque
              </label>
              <input
                type="text"
                placeholder="Ex: SEAL-789012"
                value={sealNumber}
                onChange={(e) => setSealNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Immatriculation Véhicule
              </label>
              <input
                type="text"
                placeholder="Ex: 12345-A-1"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Chauffeur & Contact
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nom chauffeur"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Téléphone"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Colis Sélection */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                Sélection des Colis en Stock Quai ({selectedParcelIds.size} / {availableParcels.length})
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                Tout sélectionner
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-800 rounded-xl p-2 bg-slate-950/40">
              {isStockLoading && (
                <div className="py-4 text-center text-slate-500 text-xs">
                  Chargement du stock quai...
                </div>
              )}

              {!isStockLoading && availableParcels.length === 0 && (
                <div className="py-4 text-center text-slate-500 text-xs">
                  Aucun colis disponible en stock quai pour préparer un transfert.
                </div>
              )}

              {availableParcels.map((p) => {
                const isSelected = selectedParcelIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleSelectParcel(p.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-blue-950/40 border-blue-800 text-slate-100"
                        : "bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectParcel(p.id)}
                        className="w-3.5 h-3.5 text-blue-600 rounded bg-slate-900 border-slate-700"
                      />
                      <span className="font-mono font-bold text-xs">{p.trackingNumber}</span>
                      <span className="text-[10px] text-slate-500">({p.weightKg} kg)</span>
                    </div>

                    {p.shipment && (
                      <span className="text-[10px] text-slate-400">
                        Dest : {p.shipment.recipientCity} ({p.shipment.recipientName})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || selectedParcelIds.size === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {createMutation.isPending
                  ? "Création du manifeste..."
                  : `Valider le transfert (${selectedParcelIds.size} colis)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
