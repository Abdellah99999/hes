import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Keyboard,
  Zap,
} from "lucide-react";

interface DetectedBarcode {
  rawValue: string;
  format?: string;
}

interface BarcodeDetectorInstance {
  detect: (
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  ) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export interface CameraBarcodeScannerProps {
  onScan: (barcode: string) => void;
  onFallback?: (errorMessage: string) => void;
  onClose?: () => void;
  facingMode?: "environment" | "user";
  scanIntervalMs?: number;
  className?: string;
  allowSimulatedScan?: boolean;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  onScan,
  onFallback,
  onClose,
  facingMode = "environment",
  scanIntervalMs = 250,
  className = "",
  allowSimulatedScan = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  const [currentFacingMode, setCurrentFacingMode] = useState<
    "environment" | "user"
  >(facingMode);
  const [status, setStatus] = useState<
    "INITIALIZING" | "SCANNING" | "DETECTED" | "PERMISSION_DENIED" | "ERROR"
  >("INITIALIZING");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState("");

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleScanSuccess = useCallback(
    (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      setStatus("DETECTED");
      setDetectedCode(cleanCode);

      // Stop camera immediately to save resources
      stopCamera();

      // Immediate haptic vibration feedback for courier
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        try {
          navigator.vibrate(100);
        } catch {
          // Vibration API might be restricted by browser policy
        }
      }

      // Notify parent callback
      onScanRef.current(cleanCode);
    },
    [stopCamera],
  );

  const startCamera = useCallback(async () => {
    stopCamera();

    // 1. Check secure context (getUserMedia requires HTTPS or localhost)
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      const msg =
        "Caméra indisponible dans un contexte non sécurisé (HTTPS requis). Saisie manuelle activée.";
      setStatus("ERROR");
      setErrorMessage(msg);
      if (onFallbackRef.current) onFallbackRef.current(msg);
      return;
    }

    // 2. Check mediaDevices availability
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      const msg =
        "Caméra non supportée par votre navigateur. Saisie manuelle activée.";
      setStatus("ERROR");
      setErrorMessage(msg);
      if (onFallbackRef.current) onFallbackRef.current(msg);
      return;
    }

    setStatus("INITIALIZING");
    setErrorMessage(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!isMountedRef.current) {
        // Stop tracks immediately if unmounted during getUserMedia async resolution
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay policy or unmount
        }
      }

      setStatus("SCANNING");

      // Setup throttled barcode detection interval
      let detector: BarcodeDetectorInstance | null = null;
      if (
        typeof window !== "undefined" &&
        "BarcodeDetector" in window &&
        window.BarcodeDetector
      ) {
        try {
          detector = new window.BarcodeDetector({
            formats: [
              "code_128",
              "code_39",
              "qr_code",
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
            ],
          });
        } catch {
          detector = null;
        }
      }

      timerRef.current = setInterval(async () => {
        if (!isMountedRef.current || isScanningRef.current) {
          return;
        }
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          return;
        }

        isScanningRef.current = true;
        try {
          if (detector) {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && isMountedRef.current) {
              const raw = barcodes[0].rawValue;
              if (raw) {
                handleScanSuccess(raw);
              }
            }
          }
        } catch {
          // Ignore individual frame detection error silently
        } finally {
          isScanningRef.current = false;
        }
      }, scanIntervalMs);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      const error = err as { name?: string; message?: string };
      const isPermissionDenied =
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError" ||
        (error.message && error.message.toLowerCase().includes("permission"));

      if (isPermissionDenied) {
        const msg = "Caméra indisponible, saisissez le numéro manuellement";
        setStatus("PERMISSION_DENIED");
        setErrorMessage(msg);
        if (onFallbackRef.current) onFallbackRef.current(msg);
      } else {
        const msg = `Erreur caméra (${error.name || "Inconnue"}): ${
          error.message || "Vérifiez vos périphériques vidéo."
        }`;
        setStatus("ERROR");
        setErrorMessage(msg);
        if (onFallbackRef.current) onFallbackRef.current(msg);
      }
    }
  }, [currentFacingMode, handleScanSuccess, scanIntervalMs, stopCamera]);

  useEffect(() => {
    isMountedRef.current = true;
    startCamera();

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [currentFacingMode, startCamera, stopCamera]);

  const toggleCamera = () => {
    setCurrentFacingMode((prev) =>
      prev === "environment" ? "user" : "environment",
    );
  };

  const handleSimulateScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCodeInput.trim()) {
      handleScanSuccess(manualCodeInput.trim());
      setManualCodeInput("");
    }
  };

  return (
    <div
      data-testid="camera-barcode-scanner"
      className={`relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl ${className}`}
    >
      {/* Video Viewport */}
      <div className="relative w-full h-64 sm:h-72 bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          data-testid="scanner-video-element"
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            status === "SCANNING" || status === "DETECTED"
              ? "opacity-100"
              : "opacity-0"
          }`}
        />

        {/* Viewfinder Target Overlay (Active when scanning or detected) */}
        {(status === "SCANNING" ||
          status === "INITIALIZING" ||
          status === "DETECTED") && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            {/* Darkened backdrop outside target */}
            <div
              className={`relative w-64 sm:w-72 h-36 sm:h-40 rounded-xl border-2 transition-all duration-300 flex items-center justify-center ${
                status === "DETECTED"
                  ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.5)]"
                  : "border-blue-400/80 bg-slate-900/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              }`}
            >
              {/* Target Corner Guides */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-inherit" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-inherit" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-inherit" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-inherit" />

              {/* Scanning Red Laser Line */}
              {status === "SCANNING" && (
                <div className="absolute inset-x-2 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
              )}

              {/* Success Badge */}
              {status === "DETECTED" && (
                <div className="flex flex-col items-center gap-1.5 text-emerald-400 bg-slate-950/80 px-3 py-2 rounded-xl border border-emerald-500/40">
                  <CheckCircle2 className="w-6 h-6 animate-bounce" />
                  <span className="text-xs font-mono font-bold tracking-wider">
                    {detectedCode}
                  </span>
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] text-slate-300 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 flex items-center gap-1.5 shadow-md">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>
                Cadrez le code-barres (Code 128) ou QR code dans le repère
              </span>
            </p>
          </div>
        )}

        {/* State: Initializing Loader */}
        {status === "INITIALIZING" && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
            <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
            <span className="text-xs font-medium text-slate-200">
              Initialisation du flux caméra sécurisé...
            </span>
          </div>
        )}

        {/* State: Permission Denied or Error */}
        {(status === "PERMISSION_DENIED" || status === "ERROR") && (
          <div
            role="alert"
            className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              {status === "PERMISSION_DENIED" ? (
                <CameraOff className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1 max-w-sm">
              <div className="text-sm font-bold text-slate-100">
                {status === "PERMISSION_DENIED"
                  ? "Accès caméra refusé"
                  : "Erreur d'initialisation caméra"}
              </div>
              <p className="text-xs text-rose-300">
                {errorMessage ||
                  "Caméra indisponible, saisissez le numéro manuellement"}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réessayer</span>
              </button>

              {onFallback && (
                <button
                  type="button"
                  onClick={() =>
                    onFallback(
                      errorMessage ||
                        "Caméra indisponible, saisissez le numéro manuellement",
                    )
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Saisie manuelle</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCamera}
            disabled={status !== "SCANNING"}
            className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-40"
            title="Basculer caméra avant/arrière"
          >
            <Camera className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px]">
              {currentFacingMode === "environment"
                ? "Caméra Arrière"
                : "Caméra Frontale"}
            </span>
          </button>

          {onFallback && (
            <button
              type="button"
              onClick={() =>
                onFallback(
                  errorMessage ||
                    "Passage à la saisie manuelle demandé par l'utilisateur.",
                )
              }
              className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Keyboard className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px]">Saisie manuelle</span>
            </button>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs transition-colors"
          >
            Fermer
          </button>
        )}
      </div>

      {/* Simulated Scan Trigger (for mobile simulators, tests, and devices without camera autofocus) */}
      {allowSimulatedScan && (
        <form
          onSubmit={handleSimulateScan}
          className="p-2.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center gap-2"
        >
          <input
            type="text"
            data-testid="simulate-barcode-input"
            value={manualCodeInput}
            onChange={(e) => setManualCodeInput(e.target.value)}
            placeholder="Simulateur scan (ex: HES-CAS-2026-000001-01)"
            className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            data-testid="simulate-barcode-btn"
            disabled={!manualCodeInput.trim()}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
          >
            Valider Scan
          </button>
        </form>
      )}
    </div>
  );
};
