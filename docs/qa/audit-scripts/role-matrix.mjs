import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3000/api/v1';

// Load tokens
const tokensFile = path.resolve(__dirname, 'tokens.json');
const tokensData = JSON.parse(fs.readFileSync(tokensFile, 'utf-8'));

const roles = [
  { key: 'ADMIN', email: 'admin@hes.ma', label: 'Admin' },
  { key: 'MANAGER', email: 'manager@hes.ma', label: 'Resp. Logistique' },
  { key: 'AGENT', email: 'agent.casa@hes.ma', label: 'Agent Agence' },
  { key: 'DISPATCHER', email: 'dispatcher@hes.ma', label: 'Agent Collecte' },
  { key: 'COURIER', email: 'courier@hes.ma', label: 'Livreur' },
  { key: 'FINANCE', email: 'finance@hes.ma', label: 'Comptable' },
  { key: 'SUPPORT', email: 'support@hes.ma', label: 'Support' },
  { key: 'CLIENT', email: 'client@shop.ma', label: 'Client' },
];

// Representative endpoints per module (Read, Create/Action, Sensitive/Admin)
const testEndpoints = [
  // 1. Agencies
  { module: 'Agences', method: 'GET', path: '/agencies', body: null, expectedAllowed: ['ADMIN', 'MANAGER'] },
  { module: 'Agences', method: 'POST', path: '/agencies', body: { code: 'TMP-AGY-99', name: 'Tmp Ag', city: 'Casablanca' }, expectedAllowed: ['ADMIN'] },
  { module: 'Agences', method: 'DELETE', path: '/agencies/fake-id', body: null, expectedAllowed: ['ADMIN'] },

  // 2. Zones
  { module: 'Zones', method: 'GET', path: '/zones', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'DISPATCHER'] },
  { module: 'Zones', method: 'POST', path: '/zones', body: { code: 'TMP-Z-99', name: 'Tmp Zone', agencyId: 'fake' }, expectedAllowed: ['ADMIN', 'MANAGER'] },
  { module: 'Zones', method: 'DELETE', path: '/zones/fake-id', body: null, expectedAllowed: ['ADMIN', 'MANAGER'] },

  // 3. Customers
  { module: 'Clients', method: 'GET', path: '/customers', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'FINANCE', 'SUPPORT'] },
  { module: 'Clients', method: 'POST', path: '/customers', body: { code: 'TMP-C-99', legalName: 'Tmp Client', agencyId: 'fake' }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },
  { module: 'Clients', method: 'POST', path: '/customers/fake-id/managers', body: { userId: 'fake' }, expectedAllowed: ['ADMIN', 'MANAGER'] },

  // 4. Customer Types
  { module: 'Types Client', method: 'GET', path: '/customer-types', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'FINANCE'] },
  { module: 'Types Client', method: 'POST', path: '/customer-types', body: { code: 'TMP_TYPE', name: 'Tmp Type' }, expectedAllowed: ['ADMIN'] },
  { module: 'Types Client', method: 'DELETE', path: '/customer-types/fake-id', body: null, expectedAllowed: ['ADMIN'] },

  // 5. Addresses
  { module: 'Adresses', method: 'GET', path: '/addresses', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'CLIENT'] },
  { module: 'Adresses', method: 'POST', path: '/addresses', body: { title: 'Tmp Addr', street: 'Street', city: 'Casablanca' }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'CLIENT'] },
  { module: 'Adresses', method: 'DELETE', path: '/addresses/fake-id', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },

  // 6. Shipments
  { module: 'Expéditions', method: 'GET', path: '/shipments', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'DISPATCHER', 'SUPPORT', 'CLIENT'] },
  { module: 'Expéditions', method: 'POST', path: '/shipments', body: { senderCustomerId: 'fake', originAgencyId: 'fake', destinationAgencyId: 'fake', parcels: [] }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },
  { module: 'Expéditions', method: 'POST', path: '/shipments/track/manual', body: { trackingNumber: 'HES-FAKE', status: 'IN_TRANSIT', agencyId: 'fake', reason: 'Audit test' }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },

  // 7. Transfers
  { module: 'Transferts', method: 'GET', path: '/transfers', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },
  { module: 'Transferts', method: 'POST', path: '/transfers', body: { originAgencyId: 'fake', destinationAgencyId: 'fake', parcelIds: [] }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },
  { module: 'Transferts', method: 'POST', path: '/transfers/fake-id/dispatch', body: {}, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },

  // 8. Collections
  { module: 'Collectes', method: 'GET', path: '/collections', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'DISPATCHER', 'CLIENT'] },
  { module: 'Collectes', method: 'POST', path: '/collections', body: { customerId: 'fake', addressId: 'fake', estimatedParcels: 1 }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'DISPATCHER', 'CLIENT'] },
  { module: 'Collectes', method: 'POST', path: '/collections/fake-id/complete', body: {}, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'DISPATCHER', 'COURIER'] },

  // 9. Runs / Dispatch
  { module: 'Tournées', method: 'GET', path: '/runs', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'DISPATCHER'] },
  { module: 'Tournées', method: 'GET', path: '/runs/my-runs', body: null, expectedAllowed: ['COURIER', 'ADMIN', 'MANAGER'] },
  { module: 'Tournées', method: 'POST', path: '/runs/auto-assign', body: { agencyId: 'fake', zoneId: 'fake', shift: 'MORNING' }, expectedAllowed: ['ADMIN', 'MANAGER', 'DISPATCHER'] },

  // 10. Deliveries
  { module: 'Livraisons', method: 'GET', path: '/deliveries/refusal-reasons', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'DISPATCHER', 'COURIER', 'SUPPORT'] },
  { module: 'Livraisons', method: 'POST', path: '/deliveries/fake-parcel/confirm', body: { proofType: 'SIGNATURE' }, expectedAllowed: ['COURIER', 'ADMIN', 'MANAGER'] },
  { module: 'Livraisons', method: 'POST', path: '/deliveries/fake-parcel/refuse', body: { refusalReasonCode: 'DAMAGED_PACKAGE' }, expectedAllowed: ['COURIER', 'ADMIN', 'MANAGER'] },

  // 11. Returns
  { module: 'Retours', method: 'GET', path: '/returns', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },
  { module: 'Retours', method: 'POST', path: '/returns', body: { shipmentId: 'fake', reason: 'Refus' }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT'] },
  { module: 'Retours', method: 'POST', path: '/returns/recover', body: { parcelTrackingNumber: 'HES-FAKE' }, expectedAllowed: ['ADMIN', 'MANAGER', 'COURIER', 'AGENT'] },

  // 12. Incidents
  { module: 'Incidents', method: 'GET', path: '/incidents', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'SUPPORT'] },
  { module: 'Incidents', method: 'POST', path: '/incidents', body: { type: 'DAMAGE', description: 'Audit test' }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'COURIER', 'SUPPORT'] },
  { module: 'Incidents', method: 'POST', path: '/incidents/fake-id/decide', body: { action: 'CLOSE' }, expectedAllowed: ['ADMIN', 'MANAGER', 'SUPPORT'] },

  // 13. Billing / Invoices
  { module: 'Facturation', method: 'GET', path: '/invoices', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'FINANCE', 'AGENT', 'CLIENT'] },
  { module: 'Facturation', method: 'POST', path: '/invoices', body: { customerId: 'fake', amount: 100 }, expectedAllowed: ['ADMIN', 'FINANCE'] },
  { module: 'Facturation', method: 'POST', path: '/invoices/fake-id/payments', body: { amount: 100, method: 'CASH' }, useIdempotencyKey: true, expectedAllowed: ['ADMIN', 'FINANCE'] },

  // 14. Documents
  { module: 'Documents', method: 'POST', path: '/documents/preview', body: { type: 'DELIVERY_NOTE', entityId: 'fake' }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'FINANCE'] },
  { module: 'Documents', method: 'POST', path: '/documents/generate', body: { type: 'DELIVERY_NOTE', entityId: 'fake' }, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'FINANCE'] },
  { module: 'Documents', method: 'GET', path: '/documents/fake-id/download-url', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'FINANCE', 'CLIENT'] },

  // 15. Reports
  { module: 'Rapports', method: 'GET', path: '/reports/dashboard', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'FINANCE', 'SUPPORT'] },
  { module: 'Rapports', method: 'GET', path: '/reports/data?type=shipments', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'FINANCE'] },
  { module: 'Rapports', method: 'GET', path: '/reports/export?type=shipments&format=EXCEL', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'FINANCE'] },

  // 16. Users / Admin
  { module: 'Utilisateurs', method: 'GET', path: '/users', body: null, expectedAllowed: ['ADMIN'] },
  { module: 'Utilisateurs', method: 'POST', path: '/users', body: { email: 'tmp@hes.ma', firstName: 'T', lastName: 'U' }, expectedAllowed: ['ADMIN'] },
  { module: 'Utilisateurs', method: 'GET', path: '/auth/me', body: null, expectedAllowed: ['ADMIN', 'MANAGER', 'AGENT', 'DISPATCHER', 'COURIER', 'FINANCE', 'SUPPORT', 'CLIENT'] },
];

async function callEndpoint(method, epPath, body, token, useIdempKey) {
  const url = `${API_BASE}${epPath}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Audit-Matrix/1.0',
  };

  if (useIdempKey) {
    headers['Idempotency-Key'] = `matrix-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  const reqOptions = {
    method,
    headers,
  };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    reqOptions.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, reqOptions);
    return res.status;
  } catch (err) {
    throw new Error(`Network / execution failure for ${method} ${url}: ${err.message}`);
  }
}

async function runMatrix() {
  console.log('=== EXECUTION DE LA MATRICE ROLE × ENDPOINT EN TEMPS REEL ===\n');

  const results = [];
  const discrepancies = [];

  for (const ep of testEndpoints) {
    const row = {
      module: ep.module,
      method: ep.method,
      path: ep.path,
      statuses: {},
    };

    for (const r of roles) {
      const userTokenObj = tokensData[r.email];
      if (!userTokenObj) {
        row.statuses[r.key] = 'NO_TOKEN';
        continue;
      }

      const status = await callEndpoint(ep.method, ep.path, ep.body, userTokenObj.token, ep.useIdempotencyKey);
      if (status === 0) {
        throw new Error(`Invalid HTTP status 0 for ${ep.method} ${ep.path}`);
      }
      row.statuses[r.key] = status;

      const isAllowedBySpec = ep.expectedAllowed.includes(r.key);
      const isHttpSuccessOrBizError = status === 200 || status === 201 || status === 400 || status === 404 || status === 409 || status === 422;
      const isHttpForbidden = status === 401 || status === 403;

      if (isAllowedBySpec && isHttpForbidden) {
        discrepancies.push({
          type: 'BLOQUANT',
          role: r.label,
          roleKey: r.key,
          endpoint: `${ep.method} ${ep.path}`,
          status,
          detail: `Accès refusé à tort (HTTP ${status}) alors que le rôle devrait y avoir accès.`,
        });
      } else if (!isAllowedBySpec && isHttpSuccessOrBizError) {
        discrepancies.push({
          type: 'GRAVE',
          role: r.label,
          roleKey: r.key,
          endpoint: `${ep.method} ${ep.path}`,
          status,
          detail: `Accès accordé à tort (HTTP ${status}) au lieu de 403 Forbidden !`,
        });
      }
    }

    results.push(row);
    console.log(`Processed: ${ep.method.padEnd(6)} ${ep.path.padEnd(35)} -> ${Object.entries(row.statuses).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  }

  // Save raw matrix JSON
  const matrixOutputPath = path.resolve(__dirname, 'role-matrix-results.json');
  fs.writeFileSync(matrixOutputPath, JSON.stringify({ results, discrepancies }, null, 2), 'utf-8');

  console.log(`\n✅ Matrice générée : ${results.length} endpoints testés pour 8 rôles (${results.length * 8} requêtes HTTP réelles).`);
  console.log(`⚠️ Divergences identifiées : ${discrepancies.length} (Grave / Bloquant).`);
}

runMatrix().catch((error) => {
  console.error(`Matrice interrompue sans ecraser le resultat precedent: ${error.message}`);
  process.exitCode = 1;
});
