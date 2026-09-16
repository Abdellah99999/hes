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
  const isAdminOrStaff = !isCourier && !isClient;

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Logo & Marque */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 text-xs sm:text-sm">
            {APP_NAME}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100 text-sm hidden sm:inline">
              {APP_NAME}
            </span>
            {user && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 border border-blue-800 text-blue-300">
                {user.role}
              </span>
            )}
          </div>
        </div>

        {/* Navigation Bureau (Hidden on mobile / tablet) */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto max-w-[70vw] py-1">
          <button
            onClick={() => setCurrentView("status")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
              currentView === "status"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Statut Infra</span>
          </button>

          {isAuthenticated && (
            <>
              {/* RÔLE LIVREUR SUR GRAND ÉCRAN */}
              {isCourier && (
                <>
                  <button
                    onClick={() => setCurrentView("my-delivery-runs")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "my-delivery-runs"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Mes Tournées</span>
                  </button>
                  <button
                    onClick={() => setCurrentView("courier-missions")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "courier-missions"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>Missions Enlèvement</span>
                  </button>
                  <button
                    onClick={() => setCurrentView("recover-return")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "recover-return"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Colis Retour</span>
                  </button>
                  <button
                    onClick={() => setCurrentView("report-incident")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "report-incident"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Signaler Incident</span>
                  </button>
                </>
              )}

              {/* RÔLE CLIENT SUR GRAND ÉCRAN */}
              {isClient && (
                <>
                  <button
                    onClick={() => setCurrentView("request-collection")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "request-collection"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Demande Enlèvement</span>
                  </button>
                  <button
                    onClick={() => setCurrentView("shipments")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "shipments"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Suivi Expéditions</span>
                  </button>
                  <button
                    onClick={() => setCurrentView("invoices")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "invoices"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Factures</span>
                  </button>
                </>
              )}

              {/* RÔLES ADMIN & EXPLOITATION SUR GRAND ÉCRAN */}
              {isAdminOrStaff && (
                <>
                  <PermissionGate permissions={["shipments:read"]}>
                    <button
                      onClick={() => setCurrentView("shipments")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                        currentView === "shipments"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Expéditions</span>
                    </button>
                    <button
                      onClick={() => setCurrentView("transfers")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                        currentView === "transfers"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Transferts</span>
                    </button>
                    <button
                      onClick={() => setCurrentView("stock")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                        currentView === "stock"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Stock Quai</span>
                    </button>
                  </PermissionGate>

                  <PermissionGate permissions={["runs:manage"]}>
                    <button
                      onClick={() => setCurrentView("delivery-assignment")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                        currentView === "delivery-assignment"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Tournées Quai</span>
                    </button>
                  </PermissionGate>

                  <button
                    onClick={() => setCurrentView("my-delivery-runs")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "my-delivery-runs"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Mes Tournées</span>
                  </button>

                  <PermissionGate permissions={["returns:manage"]}>
                    <button
                      onClick={() => setCurrentView("returns-monitoring")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                        currentView === "returns-monitoring"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Suivi Retours</span>
                    </button>
                  </PermissionGate>

                  <PermissionGate permissions={["incidents:manage"]}>
                    <button
                      onClick={() => setCurrentView("incidents-management")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                        currentView === "incidents-management"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>Litiges</span>
                    </button>
                  </PermissionGate>

                  <button
                    onClick={() => setCurrentView("invoices")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "invoices"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Factures</span>
                  </button>

                  <button
                    onClick={() => setCurrentView("customers")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "customers"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <CustomersIcon className="w-3.5 h-3.5" />
                    <span>Clients</span>
                  </button>

                  <button
                    onClick={() => setCurrentView("zones")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "zones"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>Zones</span>
                  </button>

                  <button
                    onClick={() => setCurrentView("addresses")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "addresses"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Adresses</span>
                  </button>

                  <PermissionGate permissions={["agencies:read"]}>
                    <button
                      onClick={() => setCurrentView("agencies")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                        currentView === "agencies"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Agences</span>
                    </button>
                  </PermissionGate>

                  <button
                    onClick={() => setCurrentView("dashboard")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "dashboard"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </button>

                  <button
                    onClick={() => setCurrentView("reports")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      currentView === "reports"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Rapports</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Contrôles Droite (Mobile & Bureau) */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* Centre de notification (Phase 14) */}
              <NotificationCenter />

              {/* Bureau Profil & Déconnexion */}
              <div className="hidden lg:flex items-center gap-2 pl-2 text-xs text-slate-300 border-l border-slate-800">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <button
                  type="button"
                  data-testid="btn-desktop-logout"
                  onClick={() => logout()}
                  title="Déconnexion"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors ml-1"
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
                  className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}

              {/* Mobile : Bouton Burger pour les Administrateurs / Équipe Quai */}
              {isAdminOrStaff && (
                <button
                  type="button"
                  data-testid="btn-open-burger-menu"
                  onClick={() => setIsDrawerOpen(true)}
                  aria-label="Ouvrir le menu d'administration"
                  className="lg:hidden p-2 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setCurrentView("login")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "login"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
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
