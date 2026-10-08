import React, { useState } from "react";
import { AppView } from "./navigation.types";
import { useAuth } from "../../auth/hooks/useAuth";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { NotificationCenter } from "../../notifications/components/NotificationCenter";
import { AdminBurgerDrawer } from "./AdminBurgerDrawer";
import { APP_NAME } from "../../../lib/config";
import {
  Activity,
  LogOut,
  User as UserIcon,
  LogIn,
  Layers,
  Building2,
  Map,
  Users as CustomersIcon,
  Navigation,
  Package,
  Truck,
  PackagePlus,
  Bike,
  RotateCcw,
  AlertOctagon,
  Gavel,
  FileText,
  BarChart3,
  Menu,
} from "lucide-react";

export interface AppNavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  currentView,
  setCurrentView,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const role = user?.role;
  const isCourier = role === "COURIER";
  const isClient = role === "CLIENT" || role === "CUSTOMER";
  const isAdmin = role === "ADMIN";
  const isAdminOrStaff = !isCourier && !isClient;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Logo Unique (Camion + Nom) */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white shrink-0">
            <Truck className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
            {APP_NAME}
          </span>
          {user && (
            <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              {user.role}
            </span>
          )}
        </div>

        {/* Navigation Bureau (Seulement si connecté) */}
        {isAuthenticated && (
          <nav
            aria-label="Navigation principale"
            className="hidden lg:flex items-center gap-1 overflow-x-auto max-w-[70vw] py-1"
          >
            {/* Lien Statut réservé à l'Admin */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setCurrentView("status")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                  currentView === "status"
                    ? "bg-blue-700 text-white font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Statut Infra</span>
              </button>
            )}

            {/* RÔLE LIVREUR */}
            {isCourier && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentView("my-delivery-runs")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "my-delivery-runs"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Mes Tournées</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView("courier-missions")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "courier-missions"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Missions Enlèvement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView("recover-return")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "recover-return"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Colis Retour</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView("report-incident")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "report-incident"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Signaler Incident</span>
                </button>
              </>
            )}

            {/* RÔLE CLIENT */}
            {isClient && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentView("request-collection")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "request-collection"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>Demande Enlèvement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView("shipments")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "shipments"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Suivi Expéditions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView("invoices")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "invoices"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Factures</span>
                </button>
              </>
            )}

            {/* RÔLES ADMIN & EXPLOITATION */}
            {isAdminOrStaff && (
              <>
                <PermissionGate permissions={["shipments:read"]}>
                  <button
                    type="button"
                    onClick={() => setCurrentView("shipments")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "shipments"
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Expéditions</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView("transfers")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "transfers"
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Transferts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView("stock")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "stock"
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Stock Quai</span>
                  </button>
                </PermissionGate>

                <PermissionGate permissions={["runs:manage"]}>
                  <button
                    type="button"
                    onClick={() => setCurrentView("delivery-assignment")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "delivery-assignment"
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Tournées Quai</span>
                  </button>
                </PermissionGate>

                <button
                  type="button"
                  onClick={() => setCurrentView("my-delivery-runs")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "my-delivery-runs"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Mes Tournées</span>
                </button>

                <PermissionGate permissions={["returns:manage"]}>
                  <button
                    type="button"
                    onClick={() => setCurrentView("returns-monitoring")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "returns-monitoring"
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Suivi Retours</span>
                  </button>
                </PermissionGate>

                <PermissionGate permissions={["incidents:manage"]}>
                  <button
                    type="button"
                    onClick={() => setCurrentView("incidents-management")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "incidents-management"
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>Litiges</span>
                  </button>
                </PermissionGate>

                <button
                  type="button"
                  onClick={() => setCurrentView("invoices")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "invoices"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Factures</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentView("customers")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "customers"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <CustomersIcon className="w-3.5 h-3.5" />
                  <span>Clients</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentView("zones")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "zones"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Zones</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentView("addresses")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "addresses"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Adresses</span>
                </button>

                <PermissionGate permissions={["agencies:read"]}>
                  <button
                    type="button"
                    onClick={() => setCurrentView("agencies")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "agencies"
                        ? "bg-blue-700 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Agences</span>
                  </button>
                </PermissionGate>

                <button
                  type="button"
                  onClick={() => setCurrentView("dashboard")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "dashboard"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentView("reports")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    currentView === "reports"
                      ? "bg-blue-700 text-white font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Rapports</span>
                </button>
              </>
            )}
          </nav>
        )}

        {/* Contrôles Droite (Mobile & Bureau) */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* Centre de notifications */}
              <NotificationCenter />

              {/* Bureau Profil & Déconnexion */}
              <div className="hidden lg:flex items-center gap-2 pl-2 text-xs text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800">
                <UserIcon className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span className="font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <button
                  type="button"
                  data-testid="btn-desktop-logout"
                  onClick={() => logout()}
                  title="Déconnexion"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile : Déconnexion rapide pour livreurs/clients */}
              {(isCourier || isClient) && (
                <button
                  type="button"
                  data-testid="btn-mobile-quick-logout"
                  onClick={() => logout()}
                  title="Déconnexion"
                  className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}

              {/* Mobile : Menu Burger pour les Administrateurs / Équipe Quai */}
              {isAdminOrStaff && (
                <button
                  type="button"
                  data-testid="btn-open-burger-menu"
                  onClick={() => setIsDrawerOpen(true)}
                  aria-label="Ouvrir le menu d'administration"
                  className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentView("login")}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                currentView === "login"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </header>

      {/* Tiroir Burger pour les Administrateurs sur Mobile */}
      <AdminBurgerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        logout={logout}
      />
    </>
  );
};

export default AppNavbar;
