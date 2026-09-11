import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/query-client";
import { AuthProvider } from "./features/auth/context/AuthContext";
import { useAuth } from "./features/auth/hooks/useAuth";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { ForgotPasswordPage } from "./features/auth/pages/ForgotPasswordPage";
import { SystemStatusPage } from "./features/system-status/SystemStatusPage";
import { ProtectedRoute } from "./features/auth/components/ProtectedRoute";
import { PermissionGate } from "./features/auth/components/PermissionGate";
import { AgenciesPage } from "./features/agencies/pages/AgenciesPage";
import { ZonesPage } from "./features/zones/pages/ZonesPage";
import { CustomersPage } from "./features/customers/pages/CustomersPage";
import { AddressesPage } from "./features/addresses/pages/AddressesPage";
import { ShipmentsPage } from "./features/shipments/pages/ShipmentsPage";
import { TransfersPage } from "./features/transfers/pages/TransfersPage";
import { AgencyStockPage } from "./features/transfers/pages/AgencyStockPage";
import { CustomerRequestCollectionPage } from "./features/collections/pages/CustomerRequestCollectionPage";
import { CourierMissionsPage } from "./features/collections/pages/CourierMissionsPage";
import { DeliveryAssignmentPage } from "./features/runs/pages/DeliveryAssignmentPage";
import { CourierMyRunsPage } from "./features/runs/pages/CourierMyRunsPage";
import { DeferredPodPage } from "./features/deliveries/pages/DeferredPodPage";
import { RecoverReturnPage } from "./features/returns/pages/RecoverReturnPage";
import { ReturnsMonitoringPage } from "./features/returns/pages/ReturnsMonitoringPage";
import { ReportIncidentPage } from "./features/incidents/pages/ReportIncidentPage";
import { IncidentsManagementPage } from "./features/incidents/pages/IncidentsManagementPage";
import { InvoicesPage } from "./features/billing/pages/InvoicesPage";
import { DashboardPage } from "./features/reports/pages/DashboardPage";
import { ReportsPage } from "./features/reports/pages/ReportsPage";
import { NotificationCenter } from "./features/notifications/components/NotificationCenter";
import { APP_NAME } from "./lib/config";
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
} from "lucide-react";

export type AppView =
  | "login"
  | "forgot-password"
  | "status"
  | "dashboard"
  | "reports"
  | "shipments"
  | "transfers"
  | "stock"
  | "request-collection"
  | "courier-missions"
  | "delivery-assignment"
  | "my-delivery-runs"
  | "deferred-pod"
  | "recover-return"
  | "returns-monitoring"
  | "report-incident"
  | "incidents-management"
  | "invoices"
  | "agencies"
  | "zones"
  | "customers"
  | "addresses";

const NavigationBar: React.FC<{
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}> = ({ currentView, setCurrentView }) => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
          {APP_NAME}
        </div>
        <span className="font-semibold text-slate-100 text-sm hidden sm:inline">
          {APP_NAME}
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => setCurrentView("status")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
            currentView === "status"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Statut Infra</span>
        </button>

        {isAuthenticated ? (
          <>
            <PermissionGate permissions={["shipments:read"]}>
              <button
                onClick={() => setCurrentView("shipments")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  currentView === "stock"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Stock Quai</span>
              </button>
            </PermissionGate>

            <button
              onClick={() => setCurrentView("request-collection")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "request-collection"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>Enlèvement</span>
            </button>

            <button
              onClick={() => setCurrentView("courier-missions")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "courier-missions"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Missions</span>
            </button>

            <PermissionGate permissions={["runs:manage"]}>
              <button
                onClick={() => setCurrentView("delivery-assignment")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "my-delivery-runs"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Mes Tournées</span>
            </button>

            <button
              onClick={() => setCurrentView("recover-return")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "recover-return"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Colis Retour</span>
            </button>

            <PermissionGate permissions={["returns:manage"]}>
              <button
                onClick={() => setCurrentView("returns-monitoring")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  currentView === "returns-monitoring"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Suivi Retours</span>
              </button>
            </PermissionGate>

            <button
              onClick={() => setCurrentView("report-incident")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "report-incident"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Incident</span>
            </button>

            <PermissionGate permissions={["incidents:manage"]}>
              <button
                onClick={() => setCurrentView("incidents-management")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "addresses"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Adresses</span>
            </button>

            <PermissionGate permissions={["agencies:read"]}>
              <button
                onClick={() => setCurrentView("agencies")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "dashboard"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentView("reports")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                currentView === "reports"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Rapports</span>
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            {/* Notification Center (Phase 14) */}
            <NotificationCenter />

            <div className="h-4 w-px bg-slate-800 mx-1" />
            <div className="flex items-center gap-2 pl-1 text-xs text-slate-300">
              <UserIcon className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium hidden lg:inline">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 border border-blue-800 text-blue-300">
                {user?.role}
              </span>
            </div>
            <button
              onClick={() => logout()}
              title="Déconnexion"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
  );
};

const MainContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>("status");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <NavigationBar
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      <main className="flex-1">
        {currentView === "status" && <SystemStatusPage />}

        {currentView === "login" && (
          <LoginPage
            onSuccess={() => setCurrentView("customers")}
            onNavigateToForgotPassword={() => setCurrentView("forgot-password")}
          />
        )}

        {currentView === "forgot-password" && (
          <ForgotPasswordPage
            onNavigateToLogin={() => setCurrentView("login")}
          />
        )}

        {currentView === "dashboard" && (
          <ProtectedRoute fallbackUrl="#">
            <DashboardPage onNavigateToReports={() => setCurrentView("reports")} />
          </ProtectedRoute>
        )}

        {currentView === "reports" && (
          <ProtectedRoute fallbackUrl="#">
            <ReportsPage />
          </ProtectedRoute>
        )}

        {currentView === "shipments" && (
          <ProtectedRoute fallbackUrl="#">
            <ShipmentsPage />
          </ProtectedRoute>
        )}

        {currentView === "transfers" && (
          <ProtectedRoute fallbackUrl="#">
            <TransfersPage />
          </ProtectedRoute>
        )}

        {currentView === "stock" && (
          <ProtectedRoute fallbackUrl="#">
            <AgencyStockPage />
          </ProtectedRoute>
        )}

        {currentView === "request-collection" && (
          <ProtectedRoute fallbackUrl="#">
            <CustomerRequestCollectionPage />
          </ProtectedRoute>
        )}

        {currentView === "courier-missions" && (
          <ProtectedRoute fallbackUrl="#">
            <CourierMissionsPage />
          </ProtectedRoute>
        )}

        {currentView === "delivery-assignment" && (
          <ProtectedRoute fallbackUrl="#">
            <DeliveryAssignmentPage />
          </ProtectedRoute>
        )}

        {currentView === "my-delivery-runs" && (
          <ProtectedRoute fallbackUrl="#">
            <CourierMyRunsPage />
          </ProtectedRoute>
        )}

        {currentView === "deferred-pod" && (
          <ProtectedRoute fallbackUrl="#">
            <DeferredPodPage />
          </ProtectedRoute>
        )}

        {currentView === "recover-return" && (
          <ProtectedRoute fallbackUrl="#">
            <RecoverReturnPage />
          </ProtectedRoute>
        )}

        {currentView === "returns-monitoring" && (
          <ProtectedRoute fallbackUrl="#">
            <ReturnsMonitoringPage />
          </ProtectedRoute>
        )}

        {currentView === "report-incident" && (
          <ProtectedRoute fallbackUrl="#">
            <ReportIncidentPage />
          </ProtectedRoute>
        )}

        {currentView === "incidents-management" && (
          <ProtectedRoute fallbackUrl="#">
            <IncidentsManagementPage />
          </ProtectedRoute>
        )}

        {currentView === "invoices" && (
          <ProtectedRoute fallbackUrl="#">
            <InvoicesPage />
          </ProtectedRoute>
        )}

        {currentView === "customers" && (
          <ProtectedRoute fallbackUrl="#">
            <CustomersPage />
          </ProtectedRoute>
        )}

        {currentView === "zones" && (
          <ProtectedRoute fallbackUrl="#">
            <ZonesPage />
          </ProtectedRoute>
        )}

        {currentView === "addresses" && (
          <ProtectedRoute fallbackUrl="#">
            <AddressesPage />
          </ProtectedRoute>
        )}

        {currentView === "agencies" && (
          <ProtectedRoute fallbackUrl="#">
            <AgenciesPage />
          </ProtectedRoute>
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
