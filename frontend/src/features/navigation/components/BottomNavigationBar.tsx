import React from "react";
import { AppView } from "./navigation.types";
import {
  Package,
  Camera,
  RotateCcw,
  AlertOctagon,
  PackagePlus,
  FileText,
} from "lucide-react";

export interface BottomNavigationBarProps {
  role?: string | null;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  onOpenScanner?: () => void;
}

export const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  role,
  currentView,
  setCurrentView,
  onOpenScanner,
}) => {
  const isCourier = role === "COURIER";
  const isClient = role === "CLIENT" || role === "CUSTOMER";

  // La Bottom Navigation Bar s'affiche uniquement pour les rôles terrain (Livreur et Client)
  if (!isCourier && !isClient) {
    return null;
  }

  return (
    <nav
      aria-label="Navigation mobile principale"
      data-testid="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-3 py-1.5 flex items-center justify-around md:hidden shadow-2xl shadow-black/80"
      style={{
        paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {isCourier && (
        <>
          {/* 1. Tournées */}
          <button
            type="button"
            data-testid="btn-bottom-my-runs"
            onClick={() => setCurrentView("my-delivery-runs")}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all ${
              currentView === "my-delivery-runs"
                ? "text-blue-400 font-semibold scale-105"
                : "text-slate-400 hover:text-slate-200 active:scale-95"
            }`}
          >
            <div className="relative">
              <Package className="w-5 h-5" />
              {currentView === "my-delivery-runs" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Tournées</span>
          </button>

          {/* 2. Scanner Rapide (Action centrale proéminente) */}
          <button
            type="button"
            data-testid="btn-bottom-scan"
            onClick={() => {
              if (onOpenScanner) {
                onOpenScanner();
              } else {
                setCurrentView("my-delivery-runs");
              }
            }}
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 -mt-4 transition-transform active:scale-95"
            title="Ouvrir le scanner caméra"
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 border-2 border-slate-900">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 text-slate-200 font-medium">
              Scanner
            </span>
          </button>

          {/* 3. Retours */}
          <button
            type="button"
            data-testid="btn-bottom-returns"
            onClick={() => setCurrentView("recover-return")}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all ${
              currentView === "recover-return"
                ? "text-blue-400 font-semibold scale-105"
                : "text-slate-400 hover:text-slate-200 active:scale-95"
            }`}
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Retours</span>
          </button>

          {/* 4. Incidents */}
          <button
            type="button"
            data-testid="btn-bottom-incidents"
            onClick={() => setCurrentView("report-incident")}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all ${
              currentView === "report-incident"
                ? "text-amber-400 font-semibold scale-105"
                : "text-slate-400 hover:text-slate-200 active:scale-95"
            }`}
          >
            <AlertOctagon className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Incident</span>
          </button>
        </>
      )}

      {isClient && (
        <>
          {/* 1. Demande Enlèvement */}
          <button
            type="button"
            data-testid="btn-bottom-request-collection"
            onClick={() => setCurrentView("request-collection")}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 px-3 rounded-xl transition-all ${
              currentView === "request-collection"
                ? "text-blue-400 font-semibold scale-105"
                : "text-slate-400 hover:text-slate-200 active:scale-95"
            }`}
          >
            <PackagePlus className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Enlèvement</span>
          </button>

          {/* 2. Suivi Colis */}
          <button
            type="button"
            data-testid="btn-bottom-shipments"
            onClick={() => setCurrentView("shipments")}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 px-3 rounded-xl transition-all ${
              currentView === "shipments"
                ? "text-blue-400 font-semibold scale-105"
                : "text-slate-400 hover:text-slate-200 active:scale-95"
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Suivi Colis</span>
          </button>

          {/* 3. Factures */}
          <button
            type="button"
            data-testid="btn-bottom-invoices"
            onClick={() => setCurrentView("invoices")}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 px-3 rounded-xl transition-all ${
              currentView === "invoices"
                ? "text-blue-400 font-semibold scale-105"
                : "text-slate-400 hover:text-slate-200 active:scale-95"
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Factures</span>
          </button>
        </>
      )}
    </nav>
  );
};
