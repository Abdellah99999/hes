import React from "react";
import { RefreshCw, ArrowUpCircle } from "lucide-react";

export interface PwaUpdateBannerProps {
  isUpdateAvailable: boolean;
  onApplyUpdate: () => void;
  onDismiss?: () => void;
}

export const PwaUpdateBanner: React.FC<PwaUpdateBannerProps> = ({
  isUpdateAvailable,
  onApplyUpdate,
  onDismiss,
}) => {
  if (!isUpdateAvailable) return null;

  return (
    <aside
      role="alert"
      aria-live="polite"
      data-testid="pwa-update-banner"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-md bg-slate-900/95 border border-blue-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-slate-100 flex items-start gap-3.5 animate-in slide-in-from-bottom duration-300"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <ArrowUpCircle className="w-5 h-5" />
      </div>

      <div className="space-y-1 flex-1">
        <div className="text-xs font-bold text-slate-100">
          Nouvelle version disponible
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Une mise à jour de l'application est prête. Cliquez pour recharger
          sans risque de perte de données.
        </p>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onApplyUpdate}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Mettre à jour maintenant</span>
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              Plus tard
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
