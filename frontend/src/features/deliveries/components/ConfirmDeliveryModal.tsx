import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  PenTool,
  Camera,
  RotateCcw,
} from "lucide-react";

interface ConfirmDeliveryModalProps {
  isOpen: boolean;
  parcel: {
    id: string;
    trackingNumber: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientCity: string;
    codAmount: number | null;
  } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ConfirmDeliveryModal: React.FC<ConfirmDeliveryModalProps> = ({
  isOpen,
  parcel,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [proofType, setProofType] = useState<
    "DIGITAL_SIGNATURE" | "PAPER_POD_PHOTO" | "RECIPIENT_IDENTITY"
  >("DIGITAL_SIGNATURE");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCin, setRecipientCin] = useState("");
  const [signatureSvg, setSignatureSvg] = useState<string>("");
  const [photoKey, setPhotoKey] = useState("");
  const [collectedCod, setCollectedCod] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Simple tactile signature canvas simulation
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    if (isOpen && parcel) {
      setRecipientName(parcel.recipientName || "");
      setRecipientCin("");
      setProofType("DIGITAL_SIGNATURE");
      setSignatureSvg("");
      setPhotoKey("");
      setCollectedCod(parcel.codAmount ? Number(parcel.codAmount) : 0);
      setNotes("");
      setErrorMessage(null);
    }
  }, [isOpen, parcel]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureSvg("");
      }
    }
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
        setSignatureSvg(canvas.toDataURL());
      }
    }
  };

  const handleStopDraw = () => {
    setIsDrawing(false);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcel) return;
      return customFetch(`/deliveries/${parcel.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          proofType,
          recipientName: recipientName.trim(),
          recipientCin: recipientCin.trim() || undefined,
          signatureDataUrl:
            proofType === "DIGITAL_SIGNATURE" ? signatureSvg : undefined,
          podPhotoStorageKey:
            proofType === "PAPER_POD_PHOTO" ? photoKey.trim() : undefined,
          collectedCodAmount:
            Number(collectedCod) > 0 ? Number(collectedCod) : undefined,
          courierNotes: notes.trim() || undefined,
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
        "Erreur lors de la confirmation de livraison.";
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
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono">
                Confirmer la Livraison
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
            if (!recipientName.trim()) {
              setErrorMessage("Le nom complet du réceptionnaire est obligatoire.");
              return;
            }
            if (proofType === "DIGITAL_SIGNATURE" && !signatureSvg) {
              setErrorMessage("Veuillez apposer une signature tactile dans le cadre prévu.");
              return;
            }
            if (proofType === "PAPER_POD_PHOTO" && !photoKey.trim()) {
              setErrorMessage("Veuillez renseigner le nom/clé de la photo du BL cacheté.");
              return;
            }
            setErrorMessage(null);
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

          {/* Recipient Coordinates recall */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-semibold">
              <span>Destinataire prévu</span>
              {parcel.codAmount && Number(parcel.codAmount) > 0 && (
                <span className="text-emerald-400 font-mono font-bold">
                  COD : {Number(parcel.codAmount).toFixed(2)} MAD
                </span>
              )}
            </div>
            <div className="text-slate-200 font-bold text-xs">{parcel.recipientName} ({parcel.recipientPhone})</div>
            <div className="text-[11px] text-slate-400">{parcel.recipientAddress}, {parcel.recipientCity}</div>
          </div>

          {/* Proof Type selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Type de Preuve de Livraison (POD) <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProofType("DIGITAL_SIGNATURE")}
                className={`p-2.5 rounded-xl border text-center transition-colors flex flex-col items-center gap-1 ${
                  proofType === "DIGITAL_SIGNATURE"
                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Signature Tactile</span>
              </button>

              <button
                type="button"
                onClick={() => setProofType("PAPER_POD_PHOTO")}
                className={`p-2.5 rounded-xl border text-center transition-colors flex flex-col items-center gap-1 ${
                  proofType === "PAPER_POD_PHOTO"
                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Photo BL Cacheté</span>
              </button>

              <button
                type="button"
                onClick={() => setProofType("RECIPIENT_IDENTITY")}
                className={`p-2.5 rounded-xl border text-center transition-colors flex flex-col items-center gap-1 ${
                  proofType === "RECIPIENT_IDENTITY"
                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Relevé CIN Direct</span>
              </button>
            </div>
          </div>

          {/* Actual recipient name and CIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Nom complet du réceptionnaire <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ex: Yassine Mansouri (ou mandataire)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                N° de CIN / Pièce d'identité
              </label>
              <input
                type="text"
                value={recipientCin}
                onChange={(e) => setRecipientCin(e.target.value)}
                placeholder="Ex: BE890123"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* POD specific input */}
          {proofType === "DIGITAL_SIGNATURE" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Signature tactile sur écran <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Effacer</span>
                </button>
              </div>
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <canvas
                  ref={canvasRef}
                  width={440}
                  height={110}
                  onMouseDown={handleStartDraw}
                  onMouseMove={handleDraw}
                  onMouseUp={handleStopDraw}
                  onMouseLeave={handleStopDraw}
                  className="w-full cursor-crosshair touch-none"
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Faites signer le client avec son doigt ou un stylet dans le cadre ci-dessus.
              </span>
            </div>
          )}

          {proofType === "PAPER_POD_PHOTO" && (
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Photo du BL tamponné / cacheté <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={photoKey}
                onChange={(e) => setPhotoKey(e.target.value)}
                placeholder="Ex: pod/bl-cachete-20260903.jpg"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* COD collected */}
          {parcel.codAmount && Number(parcel.codAmount) > 0 && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-300 block">
                  Encaissement COD espèces
                </span>
                <span className="text-[10px] text-emerald-400/80">
                  Montant contractuel : {Number(parcel.codAmount).toFixed(2)} MAD
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={collectedCod}
                  onChange={(e) => setCollectedCod(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2.5 py-1.5 bg-slate-900 border border-emerald-700/60 rounded-lg text-xs font-mono font-bold text-emerald-300 text-right focus:outline-none"
                />
                <span className="font-mono text-emerald-400 text-xs">MAD</span>
              </div>
            </div>
          )}

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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{mutation.isPending ? "Validation..." : "Confirmer la Livraison (POD)"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
