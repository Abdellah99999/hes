import React, { useState, useEffect } from "react";
import { WifiOff, CheckCircle2 } from "lucide-react";

export const NetworkStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [showReconnectedBadge, setShowReconnectedBadge] =
    useState<boolean>(false);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedBadge(true);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        setShowReconnectedBadge(false);
      }, 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedBadge(false);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Mode hors-ligne persistant tant que le réseau n'est pas revenu
  if (!isOnline) {
    return (
      <aside
        role="status"
        aria-live="assertive"
        data-testid="pwa-offline-banner"
        className="fixed top-0 inset-x-0 z-50 bg-amber-950/95 border-b border-amber-600 text-amber-200 px-4 py-2 text-xs flex items-center justify-center gap-2 backdrop-blur-md shadow-lg shadow-black/40 animate-in slide-in-from-top duration-300"
      >
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        <span className="font-semibold">
          Mode hors-ligne : connexion réseau interrompue. Les actions
          nécessitant le serveur sont suspendues.
        </span>
      </aside>
    );
  }

  // Transition de reconnexion temporaire (3.5s) sans rechargement de page
  if (showReconnectedBadge) {
    return (
      <aside
        role="status"
        aria-live="polite"
        data-testid="pwa-reconnected-banner"
        className="fixed top-0 inset-x-0 z-50 bg-emerald-950/95 border-b border-emerald-600 text-emerald-200 px-4 py-2 text-xs flex items-center justify-center gap-2 backdrop-blur-md shadow-lg shadow-black/40 animate-in slide-in-from-top fade-in duration-300"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-semibold">
          Connexion rétablie — Système reconnecté au serveur.
        </span>
      </aside>
    );
  }

  return null;
};
