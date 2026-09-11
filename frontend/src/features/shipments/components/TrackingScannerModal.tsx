import React, { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { ParcelStatus } from "../schemas/shipment.schema";
import {
  X,
  Barcode,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface TrackingScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ScanResponse {
  duplicate: boolean;
  message: string;
  source: string;
  parcel?: {
    id: string;
    trackingNumber: string;
    status: ParcelStatus;
  };
}

export const TrackingScannerModal: React.FC<TrackingScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<ParcelStatus | "">("");
  const [activeMode, setActiveMode] = useState<"SCANNER" | "CAMERA" | "MANUAL">("SCANNER");

  const [lastResult, setLastResult] = useState<ScanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-focus input when modal opens or mode switches to scanner
  useEffect(() => {
    if (isOpen && activeMode === "SCANNER") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, activeMode]);

  const scanMutation = useMutation({
    mutationFn: async (payload: { barcode: string; targetStatus?: ParcelStatus }) => {
      return customFetch<ScanResponse>("/shipments/track/scan", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      setLastResult(data);
      setErrorMessage(null);
      setBarcodeInput("");
      if (onSuccess) onSuccess();
      // Re-focus scanner input for next parcel
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors du traitement du scan.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
      setLastResult(null);
    },
  });

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setErrorMessage(null);
    setLastResult(null);

    scanMutation.mutate({
      barcode: barcodeInput.trim(),
      targetStatus: selectedTargetStatus ? (selectedTargetStatus as ParcelStatus) : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Poste de Scan & Réception Colis
              </h2>
              <p className="text-xs text-slate-400">
                Traitement optique Code 128 / QR Code avec déduplication 60s
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

        {/* Input Mode Selector */}
        <div className="grid grid-cols-3 border-b border-slate-800 text-xs font-medium bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveMode("SCANNER")}
            className={`py-3 flex items-center justify-center gap-2 border-r border-slate-800 transition-colors ${
              activeMode === "SCANNER"
                ? "bg-blue-600/10 text-blue-400 border-b-2 border-b-blue-500 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Douchette Quai (HID)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("CAMERA")}
            className={`py-3 flex items-center justify-center gap-2 border-r border-slate-800 transition-colors ${
              activeMode === "CAMERA"
                ? "bg-blue-600/10 text-blue-400 border-b-2 border-b-blue-500 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Caméra 2D (Mobile)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("MANUAL")}
            className={`py-3 flex items-center justify-center gap-2 transition-colors ${
              activeMode === "MANUAL"
                ? "bg-blue-600/10 text-blue-400 border-b-2 border-b-blue-500 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Saisie Clavier</span>
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Target Status Context */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Contexte d'étape logistique
            </label>
            <select
              value={selectedTargetStatus}
              onChange={(e) => setSelectedTargetStatus(e.target.value as ParcelStatus)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Automatique (Déduit de la machine à états) --</option>
              <option value="PICKED_UP">Prise en charge (PICKED_UP)</option>
              <option value="IN_TRANSIT">En cours de transfert (IN_TRANSIT)</option>
              <option value="AT_HUB">Réception quai / Hub (AT_HUB)</option>
              <option value="OUT_FOR_DELIVERY">Mise en tournée livraison (OUT_FOR_DELIVERY)</option>
              <option value="DELIVERED">Livraison client confirmée (DELIVERED)</option>
              <option value="DELIVERY_FAILED">Échec de livraison (DELIVERY_FAILED)</option>
            </select>
          </div>

          {/* Mode 1 & 3 : Scanner & Saisie */}
          {activeMode !== "CAMERA" ? (
            <form onSubmit={handleScanSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {activeMode === "SCANNER"
                    ? "Scannez le code-barres ou QR code (auto-détection)"
                    : "Saisissez le numéro de tracking (ex: HES-CAS-2026-000001-01)"}
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Prêt pour le scan... (ou taper et appuyer sur Entrée)"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    disabled={scanMutation.isPending}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 shadow-inner"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-500 font-mono">
                      ↵ ENTRÉE
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setBarcodeInput("");
                    setLastResult(null);
                    setErrorMessage(null);
                    inputRef.current?.focus();
                  }}
                  className="px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser</span>
                </button>
                <button
                  type="submit"
                  disabled={!barcodeInput.trim() || scanMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>{scanMutation.isPending ? "Traitement..." : "Traiter le scan"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Mode 2 : Camera Interface Placeholder */
            <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-slate-950/40">
              <Camera className="w-10 h-10 text-slate-500 mx-auto animate-pulse" />
              <div className="text-slate-300 font-semibold">Module Caméra Web / PDA Prêt</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                L'API MediaDevices Camera est initialisée pour les terminaux mobiles et PDA Android industriels avec autofocus.
              </p>
              <button
                type="button"
                onClick={() => setActiveMode("SCANNER")}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Basculer en saisie manuelle / douchette</span>
              </button>
            </div>
          )}

          {/* Success Banner */}
          {lastResult && !lastResult.duplicate && (
            <div
              role="status"
              className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{lastResult.message}</div>
                {lastResult.parcel && (
                  <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                    Colis : {lastResult.parcel.trackingNumber} · Statut : {lastResult.parcel.status}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deduplication Warning Banner */}
          {lastResult && lastResult.duplicate && (
            <div
              role="status"
              className="p-4 bg-amber-950/60 border border-amber-800 rounded-xl text-amber-300 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Scan dupliqué (Dédoublonné automatiquement)</div>
                <div className="text-[11px] text-amber-400/90 mt-0.5">
                  {lastResult.message}
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Erreur de traitement du scan</div>
                <div className="text-[11px] text-rose-300/90 mt-0.5">{errorMessage}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
