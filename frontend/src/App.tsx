import React, { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/query-client";
import { AuthProvider } from "./features/auth/context/AuthContext";
import { registerServiceWorker } from "./lib/pwa-service";
import { NetworkStatusIndicator } from "./features/pwa/components/NetworkStatusIndicator";
import { PwaUpdateBanner } from "./features/pwa/components/PwaUpdateBanner";
import { useAuth } from "./features/auth/hooks/useAuth";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { ForgotPasswordPage } from "./features/auth/pages/ForgotPasswordPage";
import { SystemStatusPage } from "./features/system-status/SystemStatusPage";
import { ProtectedRoute } from "./features/auth/components/ProtectedRoute";
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
import { AppNavbar } from "./features/navigation/components/AppNavbar";
import { BottomNavigationBar } from "./features/navigation/components/BottomNavigationBar";
import { TrackingScannerModal } from "./features/shipments/components/TrackingScannerModal";
import { AppView } from "./features/navigation/components/navigation.types";

export type { AppView };

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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

      <main className="flex-1 pb-20 md:pb-6">
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
      </main>

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
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
