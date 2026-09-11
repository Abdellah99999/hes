import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  X,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  ShieldAlert,
} from "lucide-react";

export interface TransferDetailItem {
  id: string;
  parcelId: string;
  status: string;
  parcel: {
    id: string;
    trackingNumber: string;
    weightKg: number;
    barcode: string;
    shipment?: {
      trackingNumber: string;
      recipientName: string;
      recipientCity: string;
    };
  };
}

export interface TransferDetail {
  id: string;
  transferNumber: string;
  originAgency: { id: string; code: string; name: string };
  destinationAgency: { id: string; code: string; name: string };
  status: string;
  sealNumber?: string | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  totalExpectedParcels: number;
  items: TransferDetailItem[];
}

interface TransferReceiveModalProps {
  isOpen: boolean;
  transfer: TransferDetail | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TransferReceiveModal: React.FC<TransferReceiveModalProps> = ({
  isOpen,
  transfer,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // Set of parcel tracking numbers or IDs marked as received
  const [receivedIds, setReceivedIds] = useState<Set<string>>(new Set());
  const [missingNotes, setMissingNotes] = useState<Record<string, string>>({});
  const [scanInput, setScanInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setReceivedIds(new Set());
      setMissingNotes({});
      setScanInput("");
      setErrorMessage(null);
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: async (payload: {
      receivedParcelIds: string[];
      missingParcelNotes?: Record<string, string>;
    }) => {
      if (!transfer) return;
      return customFetch(`/transfers/${transfer.id}/receive`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["agency-stock"] });
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
        "Erreur lors de la réception transactionnelle du transfert.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  if (!isOpen || !transfer) return null;

  const expectedItems = transfer.items || [];
  const expectedCount = expectedItems.length;
  const receivedCount = receivedIds.size;
  const missingCount = expectedCount - receivedCount;

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = scanInput.trim().toUpperCase();
    if (!clean) return;

    // Find parcel in expected items
    const match = expectedItems.find(
      (item) =>
        item.parcel.trackingNumber.toUpperCase() === clean ||
        item.parcel.id.toUpperCase() === clean ||
        item.parcel.barcode.toUpperCase() === clean,
    );

    if (match) {
      const next = new Set(receivedIds);
      next.add(match.parcel.id);
      setReceivedIds(next);
      setScanInput("");
      setErrorMessage(null);
    } else {
      setErrorMessage(`Le colis scanné '${clean}' n'appartient pas à ce manifeste de transfert.`);
    }
  };

  const toggleCheckParcel = (parcelId: string) => {
    const next = new Set(receivedIds);
    if (next.has(parcelId)) {
      next.delete(parcelId);
    } else {
      next.add(parcelId);
    }
    setReceivedIds(next);
  };

  const handleSelectAll = () => {
    const all = new Set(expectedItems.map((i) => i.parcel.id));
    setReceivedIds(all);
  };

  const handleSubmitReception = () => {
    mutation.mutate({
      receivedParcelIds: Array.from(receivedIds),
      missingParcelNotes: missingNotes,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 font-mono">
                  Réception Transfert {transfer.transferNumber}
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Provenance : {transfer.originAgency?.name} ({transfer.originAgency?.code}) → Destination : {transfer.destinationAgency?.name} ({transfer.destinationAgency?.code})
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

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-xs">
          {/* Metrics summary: Expected vs Received vs Missing */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
              <span className="text-[11px] text-slate-400 block mb-0.5">Colis Attendus (Manifeste)</span>
              <span className="text-xl font-bold text-slate-100 font-mono">{expectedCount}</span>
            </div>

            <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-center">
              <span className="text-[11px] text-emerald-400 block mb-0.5">Colis Pointés / Reçus</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{receivedCount}</span>
            </div>

            <div
              className={`p-3.5 rounded-xl text-center border ${
                missingCount > 0
                  ? "bg-rose-950/40 border-rose-800 text-rose-300"
                  : "bg-slate-950/60 border-slate-800 text-slate-400"
              }`}
            >
              <span className="text-[11px] block mb-0.5">Écart / Manquants</span>
              <span className="text-xl font-bold font-mono">
                {missingCount > 0 ? `-${missingCount}` : "0"}
              </span>
            </div>
          </div>

          {/* Discrepancy Alert Banner if missingCount > 0 */}
          {missingCount > 0 && (
            <div
              role="alert"
              aria-label="Alerte colis manquant"
              className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  Alerte : Écart de déchargement détecté ({missingCount} colis manquant{missingCount > 1 ? "s" : ""})
                </span>
                <span className="text-[11px] text-rose-300/90 block mt-0.5">
                  Les colis non pointés seront déclarés "PERDUS EN TRANSIT" (LOST) et donneront lieu à une alerte d'audit de sécurité horodatée.
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Fast scan bar */}
          <form onSubmit={handleScanSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Scannez ou tapez un code-barres colis..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={!scanInput.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5"
            >
              <Barcode className="w-4 h-4" />
              <span>Pointer</span>
            </button>
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-2.5 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
            >
              Tout pointer
            </button>
          </form>

          {/* List of Expected Parcels with interactive checkbox */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium px-1">
              <span>Colis du Manifeste ({expectedCount})</span>
              <span>Statut Pointage</span>
            </div>

            <div className="space-y-2">
              {expectedItems.map((item) => {
                const isChecked = receivedIds.has(item.parcel.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleCheckParcel(item.parcel.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                      isChecked
                        ? "bg-emerald-950/20 border-emerald-800/80 hover:bg-emerald-950/30"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheckParcel(item.parcel.id)}
                        className="w-4 h-4 text-blue-600 rounded bg-slate-900 border-slate-700 focus:ring-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-100 text-xs">
                            {item.parcel.trackingNumber}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            ({item.parcel.weightKg} kg)
                          </span>
                        </div>
                        {item.parcel.shipment && (
                          <span className="text-[11px] text-slate-400 block">
                            Destinataire : {item.parcel.shipment.recipientName} ({item.parcel.shipment.recipientCity})
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {isChecked ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-semibold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>REÇU CONFORME</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/80 font-semibold text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>MANQUANT</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldAlert className="w-4 h-4 text-blue-400" />
            <span>Réception transactionnelle atomique (PostgreSQL ACID)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmitReception}
              disabled={mutation.isPending}
              className={`px-5 py-2 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md ${
                missingCount > 0
                  ? "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {mutation.isPending
                  ? "Réconciliation en cours..."
                  : missingCount > 0
                  ? `Clôturer avec ${missingCount} manquant(s)`
                  : "Valider la réception complète"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
