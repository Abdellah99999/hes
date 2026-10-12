const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');

const screens = [
  { id: 'status', file: 'features/system-status/SystemStatusPage.tsx', name: 'SystemStatusPage' },
  { id: 'login', file: 'features/auth/pages/LoginPage.tsx', name: 'LoginPage' },
  { id: 'forgot-password', file: 'features/auth/pages/ForgotPasswordPage.tsx', name: 'ForgotPasswordPage' },
  { id: 'dashboard', file: 'features/reports/pages/DashboardPage.tsx', name: 'DashboardPage' },
  { id: 'reports', file: 'features/reports/pages/ReportsPage.tsx', name: 'ReportsPage' },
  { id: 'shipments', file: 'features/shipments/pages/ShipmentsPage.tsx', name: 'ShipmentsPage' },
  { id: 'transfers', file: 'features/transfers/pages/TransfersPage.tsx', name: 'TransfersPage' },
  { id: 'stock', file: 'features/transfers/pages/AgencyStockPage.tsx', name: 'AgencyStockPage' },
  { id: 'request-collection', file: 'features/collections/pages/CustomerRequestCollectionPage.tsx', name: 'CustomerRequestCollectionPage' },
  { id: 'courier-missions', file: 'features/collections/pages/CourierMissionsPage.tsx', name: 'CourierMissionsPage' },
  { id: 'delivery-assignment', file: 'features/runs/pages/DeliveryAssignmentPage.tsx', name: 'DeliveryAssignmentPage' },
  { id: 'my-delivery-runs', file: 'features/runs/pages/CourierMyRunsPage.tsx', name: 'CourierMyRunsPage' },
  { id: 'deferred-pod', file: 'features/deliveries/pages/DeferredPodPage.tsx', name: 'DeferredPodPage' },
  { id: 'recover-return', file: 'features/returns/pages/RecoverReturnPage.tsx', name: 'RecoverReturnPage' },
  { id: 'returns-monitoring', file: 'features/returns/pages/ReturnsMonitoringPage.tsx', name: 'ReturnsMonitoringPage' },
  { id: 'report-incident', file: 'features/incidents/pages/ReportIncidentPage.tsx', name: 'ReportIncidentPage' },
  { id: 'incidents-management', file: 'features/incidents/pages/IncidentsManagementPage.tsx', name: 'IncidentsManagementPage' },
  { id: 'invoices', file: 'features/billing/pages/InvoicesPage.tsx', name: 'InvoicesPage' },
  { id: 'customers', file: 'features/customers/pages/CustomersPage.tsx', name: 'CustomersPage' },
  { id: 'zones', file: 'features/zones/pages/ZonesPage.tsx', name: 'ZonesPage' },
  { id: 'addresses', file: 'features/addresses/pages/AddressesPage.tsx', name: 'AddressesPage' },
  { id: 'agencies', file: 'features/agencies/pages/AgenciesPage.tsx', name: 'AgenciesPage' },
];

let output = '=== FRONTEND STATIC MAP AUDIT (NO BROWSER) ===\n\n';
output += '1. LISTE DES ECRANS ET COMPOSANTS ENREGISTRES (App.tsx)\n';
output += '------------------------------------------------------------------------------------\n';

for (const s of screens) {
  const fullPath = path.join(frontendSrc, s.file);
  const exists = fs.existsSync(fullPath);
  output += `View ID: [${s.id.padEnd(22)}] Component: [${s.name.padEnd(30)}] File: ${s.file} (Exists: ${exists})\n`;
}

output += '\n2. COMMUTATEUR DE ROUTAGE DANS App.tsx\n';
output += '------------------------------------------------------------------------------------\n';
output += 'Routing Switcher: State `currentView` in `MainContent` (App.tsx:155)\n';
output += 'Condition: React.Suspense avec rendu conditionnel {currentView === "<id>" && <Page />}\n';
output += 'Pages protégées par ProtectedRoute: dashboard, reports, shipments, transfers, stock,\n';
output += 'request-collection, courier-missions, delivery-assignment, my-delivery-runs, deferred-pod,\n';
output += 'recover-return, returns-monitoring, report-incident, incidents-management, invoices,\n';
output += 'customers, zones, addresses, agencies.\n';

output += '\n3. CONFIGURATION DE NAVIGATION PAR ROLE (ANALYSE STATIQUE)\n';
output += '------------------------------------------------------------------------------------\n';

const roleNavMap = {
  'ADMIN': {
    desktop: ['status', 'shipments', 'transfers', 'stock', 'delivery-assignment', 'my-delivery-runs', 'returns-monitoring', 'incidents-management', 'invoices', 'customers', 'zones', 'addresses', 'agencies', 'dashboard', 'reports'],
    drawer: ['shipments', 'transfers', 'stock', 'delivery-assignment', 'my-delivery-runs', 'courier-missions', 'recover-return', 'returns-monitoring', 'request-collection', 'report-incident', 'incidents-management', 'invoices', 'customers', 'zones', 'addresses', 'agencies', 'dashboard', 'reports', 'status'],
    bottomBar: 'None (Drawer & Navbar used)'
  },
  'MANAGER / RESPONSABLE LOGISTIQUE': {
    desktop: ['shipments', 'transfers', 'stock', 'delivery-assignment', 'my-delivery-runs', 'returns-monitoring', 'incidents-management', 'invoices', 'customers', 'zones', 'addresses', 'agencies (if perm agencies:read)', 'dashboard', 'reports'],
    drawer: ['shipments', 'transfers', 'stock', 'delivery-assignment', 'my-delivery-runs', 'courier-missions', 'recover-return', 'returns-monitoring', 'request-collection', 'report-incident', 'incidents-management', 'invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    bottomBar: 'None'
  },
  'AGENT / AGENT AGENCE': {
    desktop: ['shipments', 'transfers', 'stock', 'my-delivery-runs', 'invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    drawer: ['shipments', 'transfers', 'stock', 'my-delivery-runs', 'courier-missions', 'recover-return', 'request-collection', 'report-incident', 'invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    bottomBar: 'None'
  },
  'DISPATCHER / AGENT COLLECTE': {
    desktop: ['shipments', 'transfers', 'stock', 'delivery-assignment', 'my-delivery-runs', 'invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    drawer: ['shipments', 'transfers', 'stock', 'delivery-assignment', 'my-delivery-runs', 'courier-missions', 'recover-return', 'request-collection', 'report-incident', 'invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    bottomBar: 'None'
  },
  'COURIER / LIVREUR': {
    desktop: ['my-delivery-runs', 'courier-missions', 'recover-return', 'report-incident'],
    drawer: 'None (Mobile optimized via BottomBar)',
    bottomBar: ['my-delivery-runs (Tournées)', 'TrackingScannerModal (Scanner)', 'recover-return (Retours)', 'report-incident (Incident)']
  },
  'FINANCE / COMPTABLE': {
    desktop: ['invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    drawer: ['invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    bottomBar: 'None'
  },
  'SUPPORT / SERVICE CLIENT': {
    desktop: ['shipments', 'incidents-management', 'invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    drawer: ['shipments', 'request-collection', 'report-incident', 'incidents-management', 'invoices', 'customers', 'zones', 'addresses', 'dashboard', 'reports'],
    bottomBar: 'None'
  },
  'CLIENT / CUSTOMER': {
    desktop: ['request-collection', 'shipments', 'invoices'],
    drawer: 'None (Mobile optimized via BottomBar)',
    bottomBar: ['request-collection (Enlèvement)', 'shipments (Suivi Colis)', 'invoices (Factures)']
  }
};

for (const [roleName, cfg] of Object.entries(roleNavMap)) {
  output += `\n[ROLE: ${roleName}]\n`;
  output += `  Desktop Navbar: ${Array.isArray(cfg.desktop) ? cfg.desktop.join(', ') : cfg.desktop}\n`;
  output += `  Burger Drawer:  ${Array.isArray(cfg.drawer) ? cfg.drawer.join(', ') : cfg.drawer}\n`;
  output += `  Bottom Bar:     ${Array.isArray(cfg.bottomBar) ? cfg.bottomBar.join(', ') : cfg.bottomBar}\n`;
}

const outputPath = path.resolve(__dirname, 'frontend-map.txt');
fs.writeFileSync(outputPath, output, 'utf-8');
console.log(`Generated frontend-map.txt at ${outputPath}`);
