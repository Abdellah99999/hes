import React, { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import { AuthProvider } from "./features/auth/context/AuthContext";
import { registerServiceWorker } from "./lib/pwa-service";
import { NetworkStatusIndicator } from "./features/pwa/components/NetworkStatusIndicator";
import { PwaUpdateBanner } from "./features/pwa/components/PwaUpdateBanner";
import { useAuth } from "./features/auth/hooks/useAuth";
import { ProtectedRoute } from "./features/auth/components/ProtectedRoute";
import { AppNavbar } from "./features/navigation/components/AppNavbar";
import { BottomNavigationBar } from "./features/navigation/components/BottomNavigationBar";
import { TrackingScannerModal } from "./features/shipments/components/TrackingScannerModal";
import { AppView } from "./features/navigation/components/navigation.types";

// Immediate load for initial landing view
import { SystemStatusPage } from "./features/system-status/SystemStatusPage";

// Code-split / Lazy-loaded routes to minimize initial bundle size and optimize Core Web Vitals
const LoginPage = React.lazy(() =>
  import("./features/auth/pages/LoginPage").then((m) => ({
    default: m.LoginPage,
  })),
);
const ForgotPasswordPage = React.lazy(() =>
  import("./features/auth/pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const DashboardPage = React.lazy(() =>
  import("./features/reports/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const ReportsPage = React.lazy(() =>
  import("./features/reports/pages/ReportsPage").then((m) => ({
    default: m.ReportsPage,
  })),
);
const ShipmentsPage = React.lazy(() =>
  import("./features/shipments/pages/ShipmentsPage").then((m) => ({
    default: m.ShipmentsPage,
  })),
);
const TransfersPage = React.lazy(() =>
  import("./features/transfers/pages/TransfersPage").then((m) => ({
    default: m.TransfersPage,
  })),
);
const AgencyStockPage = React.lazy(() =>
  import("./features/transfers/pages/AgencyStockPage").then((m) => ({
    default: m.AgencyStockPage,
  })),
);
const CustomerRequestCollectionPage = React.lazy(() =>
  import("./features/collections/pages/CustomerRequestCollectionPage").then(
    (m) => ({
      default: m.CustomerRequestCollectionPage,
    }),
  ),
);
const CourierMissionsPage = React.lazy(() =>
  import("./features/collections/pages/CourierMissionsPage").then((m) => ({
    default: m.CourierMissionsPage,
  })),
);
const DeliveryAssignmentPage = React.lazy(() =>
  import("./features/runs/pages/DeliveryAssignmentPage").then((m) => ({
    default: m.DeliveryAssignmentPage,
  })),
);
const CourierMyRunsPage = React.lazy(() =>
  import("./features/runs/pages/CourierMyRunsPage").then((m) => ({
    default: m.CourierMyRunsPage,
  })),
);
const DeferredPodPage = React.lazy(() =>
  import("./features/deliveries/pages/DeferredPodPage").then((m) => ({
    default: m.DeferredPodPage,
  })),
);
const RecoverReturnPage = React.lazy(() =>
  import("./features/returns/pages/RecoverReturnPage").then((m) => ({
    default: m.RecoverReturnPage,
  })),
);
const ReturnsMonitoringPage = React.lazy(() =>
  import("./features/returns/pages/ReturnsMonitoringPage").then((m) => ({
    default: m.ReturnsMonitoringPage,
  })),
);
const ReportIncidentPage = React.lazy(() =>
  import("./features/incidents/pages/ReportIncidentPage").then((m) => ({
    default: m.ReportIncidentPage,
  })),
);
const IncidentsManagementPage = React.lazy(() =>
  import("./features/incidents/pages/IncidentsManagementPage").then((m) => ({
    default: m.IncidentsManagementPage,
  })),
);
const InvoicesPage = React.lazy(() =>
  import("./features/billing/pages/InvoicesPage").then((m) => ({
    default: m.InvoicesPage,
  })),
);
const CustomersPage = React.lazy(() =>
  import("./features/customers/pages/CustomersPage").then((m) => ({
    default: m.CustomersPage,
  })),
);
const ZonesPage = React.lazy(() =>
  import("./features/zones/pages/ZonesPage").then((m) => ({
    default: m.ZonesPage,
  })),
);
const AddressesPage = React.lazy(() =>
  import("./features/addresses/pages/AddressesPage").then((m) => ({
    default: m.AddressesPage,
  })),
);
const AgenciesPage = React.lazy(() =>
  import("./features/agencies/pages/AgenciesPage").then((m) => ({
    default: m.AgenciesPage,
  })),
);

// Conditionally load ReactQueryDevtools only in development
const Devtools = import.meta.env.DEV
  ? React.lazy(() =>
      import("@tanstack/react-query-devtools").then((d) => ({
        default: d.ReactQueryDevtools,
      })),
    )
  : null;

export type { AppView };

const RouteLoadingFallback: React.FC = () => (
  <div
    className="flex items-center justify-center min-h-[40vh] p-8 text-slate-400"
    role="status"
    aria-label="Chargement"
  >
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-medium tracking-wide">
        Chargement du module...
      </span>
    </div>
  </div>
);

const MainContent: React.FC = () => {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>("status");
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [applyUpdateFn, setApplyUpdateFn] = useState<(() => void) | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  useEffect(() => {
    registerServiceWorker({
      onUpdateAvailable: (applyFn) => {
        setApplyUpdateFn(() => applyFn);
        setUpdateAvailable(true);
      },
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <NetworkStatusIndicator />
      <PwaUpdateBanner
        isUpdateAvailable={updateAvailable}
        onApplyUpdate={() => {
          if (applyUpdateFn) applyUpdateFn();
        }}
        onDismiss={() => setUpdateAvailable(false)}
      />
      <AppNavbar currentView={currentView} setCurrentView={setCurrentView} />
      <TrackingScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      <main className="flex-1 pb-20 lg:pb-6">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          {currentView === "status" && <SystemStatusPage />}

          {currentView === "login" && (
            <LoginPage
              onSuccess={() => setCurrentView("customers")}
              onNavigateToForgotPassword={() =>
                setCurrentView("forgot-password")
              }
            />
          )}

          {currentView === "forgot-password" && (
            <ForgotPasswordPage
              onNavigateToLogin={() => setCurrentView("login")}
            />
          )}

          {currentView === "dashboard" && (
            <ProtectedRoute fallbackUrl="#">
              <DashboardPage
                onNavigateToReports={() => setCurrentView("reports")}
              />
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
        </React.Suspense>
      </main>

      <footer className="mt-auto py-3 px-4 text-center text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pb-16 lg:pb-3">
        <div className="flex items-center justify-center gap-3">
          <span>HES Transport & Logistique &copy; 2026</span>
          <span>•</span>
          <button
            type="button"
            onClick={() => setCurrentView("status")}
            className="text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 underline"
          >
            Statut système
          </button>
        </div>
      </footer>

      <BottomNavigationBar
        role={user?.role}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenScanner={() => setIsScannerOpen(true)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
      {Devtools && (
        <React.Suspense fallback={null}>
          <Devtools initialIsOpen={false} />
        </React.Suspense>
      )}
    </QueryClientProvider>
  );
};

export default App;
