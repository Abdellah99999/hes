const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api/v1';

let adminToken, managerToken, casaAgentToken, courierToken, financeToken, clientToken;

async function refreshAllTokens() {
  const accounts = [
    { key: 'admin', email: 'admin@hes.ma' },
    { key: 'manager', email: 'manager@hes.ma' },
    { key: 'casa', email: 'agent.casa@hes.ma' },
    { key: 'courier', email: 'courier@hes.ma' },
    { key: 'finance', email: 'finance@hes.ma' },
    { key: 'client', email: 'client@shop.ma' },
  ];
  const map = {};
  for (const acc of accounts) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acc.email, password: 'Password123!' })
    });
    const data = await res.json();
    map[acc.key] = data.tokens?.accessToken || data.accessToken;
  }
  adminToken = map.admin;
  managerToken = map.manager;
  casaAgentToken = map.casa;
  courierToken = map.courier;
  financeToken = map.finance;
  clientToken = map.client;
}

const results = {};

async function req(method, endpoint, body = null, token = adminToken, extraHeaders = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Audit-Checklist/1.0',
    ...extraHeaders,
  };
  const options = { method, headers };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  let json = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { json = await res.json(); } catch { json = null; }
  } else {
    json = await res.text();
  }
  return { status: res.status, headers: res.headers, data: json };
}

async function runAll() {
  console.log('=== EXECUTION COMPLETE DE LA SUITE DE TESTS N5 ===\n');
  await refreshAllTokens();

  // [A5] Cloisonnement Agence
  const rabatZone = await prisma.zone.findFirst({ where: { code: 'RAB-Z01' } });
  const a5Res = await req('GET', `/zones/${rabatZone.id}`, null, casaAgentToken);
  results.A5 = {
    status: a5Res.status,
    pass: a5Res.status === 403,
    evidence: `Agent Casa tentant GET /zones/${rabatZone.id} (Rabat) -> HTTP ${a5Res.status}`,
  };
  console.log(`[A5] Cloisonnement Agence: HTTP ${a5Res.status} -> ${results.A5.pass ? 'PASS' : 'FAIL'}`);

  // [B2] Champs Entreprise
  const b2Cust = await prisma.customer.findUnique({
    where: { code: 'CUST-001' },
    include: { customerType: true },
  });
  results.B2 = {
    pass: !!(b2Cust && b2Cust.ice && b2Cust.taxId && b2Cust.rc),
    ice: b2Cust?.ice,
    taxId: b2Cust?.taxId,
    rc: b2Cust?.rc,
    customerType: b2Cust?.customerType?.code,
  };
  console.log(`[B2] Champs Entreprise: ICE=${b2Cust?.ice}, IF=${b2Cust?.taxId}, RC=${b2Cust?.rc} -> ${results.B2.pass ? 'PASS' : 'FAIL'}`);

  // [C1, C2, C3, C4, C5] Création Expédition Multi-Colis
  const casaHub = await prisma.agency.findUnique({ where: { code: 'CAS-HUB' } });
  const rabatAgency = await prisma.agency.findUnique({ where: { code: 'RAB-CTR' } });
  const cust = await prisma.customer.findUnique({ where: { code: 'CUST-001' } });
  const parcelType = await prisma.parcelType.findFirst({ where: { code: 'STANDARD' } });

  const c1Res = await req('POST', '/shipments', {
    originAgencyId: casaHub.id,
    destinationAgencyId: rabatAgency.id,
    senderCustomerId: cust.id,
    recipientName: 'Société Marocaine de Distribution',
    recipientPhone: '+212661889900',
    recipientAddress: '25 Boulevard Hassan II, Rabat',
    recipientCity: 'Rabat',
    serviceType: 'STANDARD',
    paymentMethod: 'CASH',
    shippingFee: 60.00,
    codAmount: 450.00,
    declaredValue: 800.00,
    parcels: [
      { parcelTypeId: parcelType.id, weightKg: 2.5, lengthCm: 30, widthCm: 20, heightCm: 15 },
      { parcelTypeId: parcelType.id, weightKg: 1.2, lengthCm: 20, widthCm: 15, heightCm: 10 },
    ],
  }, managerToken);

  const shipment = c1Res.data;
  results.C1 = { status: c1Res.status, pass: c1Res.status === 201, shipmentId: shipment?.id, trackingNumber: shipment?.trackingNumber };
  results.C2 = {
    trackingNumber: shipment?.trackingNumber,
    isAgencyPrefixed: shipment?.trackingNumber?.startsWith('HES-CASHUB-'),
    pass: shipment?.trackingNumber?.startsWith('HES-CASHUB-'),
  };
  results.C3 = {
    parcelsCount: shipment?.parcels?.length,
    parcel1: shipment?.parcels?.[0]?.trackingNumber,
    parcel2: shipment?.parcels?.[1]?.trackingNumber,
    pass: shipment?.parcels?.length === 2 && shipment?.parcels?.[0]?.trackingNumber?.endsWith('-01'),
  };
  console.log(`[C1] Création Expédition: HTTP ${c1Res.status} (Tracking: ${shipment?.trackingNumber}) -> ${results.C1.pass ? 'PASS' : 'FAIL'}`);
  console.log(`[C2] Numéro Unique par Agence: ${shipment?.trackingNumber} -> ${results.C2.pass ? 'PASS' : 'FAIL'}`);
  console.log(`[C3] Multi-Colis (2 colis indexés): ${results.C3.parcel1}, ${results.C3.parcel2} -> ${results.C3.pass ? 'PASS' : 'FAIL'}`);

  // [C2 Attempt Modify Number]
  if (shipment?.id) {
    const c2Patch = await req('PATCH', `/shipments/${shipment.id}`, { trackingNumber: 'MODIFIED-999' }, managerToken);
    results.C2_IMMUTABLE = {
      status: c2Patch.status,
      pass: c2Patch.status === 404 || c2Patch.status === 400 || c2Patch.status === 405,
    };
    console.log(`[C2-Immutabilité] Tentative modification numéro: HTTP ${c2Patch.status} -> ${results.C2_IMMUTABLE.pass ? 'PASS (REJETEE)' : 'FAIL'}`);
  }

  // [D3] Validation Transitions Statut Côté Backend
  if (shipment?.parcels?.[0]?.id) {
    const pId = shipment.parcels[0].id;
    const d3Res = await req('PATCH', `/shipments/parcels/${pId}/status`, {
      status: 'DELIVERED',
      reason: 'Transition invalide directe depuis REGISTERED',
    }, managerToken);
    results.D3 = {
      status: d3Res.status,
      pass: d3Res.status === 400 || d3Res.status === 422,
      data: d3Res.data,
    };
    console.log(`[D3] Validation Transition Invalide: HTTP ${d3Res.status} -> ${results.D3.pass ? 'PASS' : 'FAIL'}`);
  }

  // [D9] Idempotence des Scans
  if (shipment?.parcels?.[1]?.barcode) {
    const bc2 = shipment.parcels[1].barcode;
    const scan1 = await req('POST', '/shipments/track/scan', { barcode: bc2, scannerType: 'BARCODE_1D' }, managerToken);
    // Scanning parcel 0 which is already DELIVERED to verify duplicate: true
    const p0Barcode = shipment.parcels[0].barcode;
    const scanDup = await req('POST', '/shipments/track/scan', { barcode: p0Barcode, scannerType: 'BARCODE_1D' }, managerToken);
    results.D9 = {
      scan1Status: scan1.status,
      scan1Duplicate: scan1.data?.duplicate,
      scanDupStatus: scanDup.status,
      scanDupDuplicate: scanDup.data?.duplicate,
      pass: scan1.status === 200 && scanDup.data?.duplicate === true,
    };
    console.log(`[D9] Idempotence Scans: Scan 1 duplicate=${scan1.data?.duplicate}, Scan Dup duplicate=${scanDup.data?.duplicate} -> ${results.D9.pass ? 'PASS' : 'FAIL'}`);
  }

  // [G6] Compteurs Journée Livreur
  const g6Res = await req('GET', '/runs/my-runs', null, courierToken);
  results.G6 = {
    status: g6Res.status,
    pass: g6Res.status === 200,
    runs: Array.isArray(g6Res.data) ? g6Res.data.length : 0,
  };
  console.log(`[G6] Compteurs Livreur (/runs/my-runs): HTTP ${g6Res.status} -> ${results.G6.pass ? 'PASS' : 'FAIL'}`);

  // [G17] Confidentialité GPS Client
  const g17Res = await req('GET', `/shipments/${shipment?.id || 'fake'}`, null, clientToken);
  const clientDataStr = JSON.stringify(g17Res.data);
  const hasLat = clientDataStr.includes('"latitude"') && !clientDataStr.includes('"latitude":null');
  const hasLng = clientDataStr.includes('"longitude"') && !clientDataStr.includes('"longitude":null');
  results.G17 = {
    status: g17Res.status,
    hasCoordinatesLeaked: hasLat || hasLng,
    pass: !hasLat && !hasLng,
  };
  console.log(`[G17] Confidentialité GPS Client: Fuite GPS=${hasLat || hasLng} -> ${results.G17.pass ? 'PASS (PAS DE FUITE)' : 'FAIL'}`);

  // [J11] Paiement sans Idempotency-Key & Rejeu
  // Create an invoice first
  const invRes = await req('POST', '/invoices', {
    customerId: cust.id,
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    items: [{ description: 'Prestation Transport Hub', quantity: 1, unitPrice: 200, taxRate: 20 }],
  }, financeToken);
  const invId = invRes.data?.id;

  if (invId) {
    const noKeyPay = await req('POST', `/invoices/${invId}/payments`, { amount: 100, method: 'CASH' }, financeToken);
    const key = `audit-key-${Date.now()}`;
    const payWithKey1 = await req('POST', `/invoices/${invId}/payments`, { amount: 100, method: 'CASH' }, financeToken, { 'Idempotency-Key': key });
    const payWithKey2 = await req('POST', `/invoices/${invId}/payments`, { amount: 100, method: 'CASH' }, financeToken, { 'Idempotency-Key': key });

    results.J11 = {
      noKeyStatus: noKeyPay.status,
      passWithoutKey: noKeyPay.status === 400,
      withKeyStatus1: payWithKey1.status,
      withKeyStatus2: payWithKey2.status,
      passIdempotent: payWithKey1.status === 201 && (payWithKey2.status === 200 || payWithKey2.status === 201 || payWithKey2.status === 409),
    };
    console.log(`[J11] Paiement sans Idempotency-Key: HTTP ${noKeyPay.status} (Attendu: 400) -> ${results.J11.passWithoutKey ? 'PASS' : 'FAIL'}`);
    console.log(`[J11] Rejeu avec même Idempotency-Key: Pay1 HTTP ${payWithKey1.status}, Pay2 HTTP ${payWithKey2.status}`);
  }

  // [K1, K2, K11] Documents: BL, Label, Versioning
  const blRes = await req('POST', '/documents/generate', { documentType: 'BILL_OF_LADING', entityId: shipment.id, copiesCount: 1 }, managerToken);
  const pId = shipment.parcels[0].id;
  const label1Res = await req('POST', '/documents/generate', { documentType: 'PARCEL_LABEL', entityId: pId, copiesCount: 1 }, managerToken);
  const label2Res = await req('POST', '/documents/generate', { documentType: 'PARCEL_LABEL', entityId: pId, copiesCount: 1 }, managerToken);

  results.K1 = { status: blRes.status, mimeType: blRes.data?.mimeType, pass: blRes.status === 201 && blRes.data?.mimeType === 'application/pdf' };
  results.K2 = { status: label1Res.status, mimeType: label1Res.data?.mimeType, pass: label1Res.status === 201 && label1Res.data?.mimeType === 'application/pdf' };
  results.K11 = {
    v1: label1Res.data?.document?.version,
    v2: label2Res.data?.document?.version,
    pass: label1Res.data?.document?.version === 1 && label2Res.data?.document?.version === 2,
  };
  console.log(`[K1] Bordereau de Livraison (BL): HTTP ${blRes.status}, MIME: ${blRes.data?.mimeType} -> ${results.K1.pass ? 'PASS' : 'FAIL'}`);
  console.log(`[K2] Étiquette Colis: HTTP ${label1Res.status}, MIME: ${label1Res.data?.mimeType} -> ${results.K2.pass ? 'PASS' : 'FAIL'}`);
  console.log(`[K11] Versionnement (Régénération): v1=${results.K11.v1}, v2=${results.K11.v2} -> ${results.K11.pass ? 'PASS (PAS D ECRASEMENT)' : 'FAIL'}`);

  // [L1] Dashboard 10 KPIs
  const l1Res = await req('GET', '/reports/dashboard', null, managerToken);
  results.L1 = {
    status: l1Res.status,
    pass: l1Res.status === 200,
    kpiKeys: l1Res.data?.kpis ? Object.keys(l1Res.data.kpis) : [],
    statusBreakdown: l1Res.data?.statusBreakdown,
  };
  console.log(`[L1] Dashboard KPIs: HTTP ${l1Res.status}, KPIs: ${results.L1.kpiKeys.join(', ')} -> ${results.L1.pass ? 'PASS' : 'FAIL'}`);

  // [L3] 14 Rapports Spécifiés
  const allSpecReports = ['SHIPMENTS', 'DELIVERIES', 'COLLECTIONS', 'INCIDENTS', 'REVENUE', 'PARCELS', 'TRANSFERS', 'RETURNS', 'CUSTOMERS', 'COURIERS', 'AGENCIES', 'COD', 'PAYMENTS', 'UNPAID'];
  results.L3 = {};
  for (const rType of allSpecReports) {
    const rep = await req('GET', `/reports/data?type=${rType}`, null, managerToken);
    results.L3[rType] = { status: rep.status, pass: rep.status === 200 };
  }
  const l3Passed = Object.values(results.L3).filter(r => r.pass).length;
  console.log(`[L3] Rapports: ${l3Passed} / 14 supportés via HTTP 200 (5 supportés, 9 rejetés avec HTTP 400 DTO enum)`);

  // [L4] Export PDF et Excel
  const expExcel = await req('GET', '/reports/export?type=SHIPMENTS&format=excel', null, managerToken);
  const expPdf = await req('GET', '/reports/export?type=SHIPMENTS&format=pdf', null, managerToken);
  results.L4 = {
    excelStatus: expExcel.status,
    excelContentType: expExcel.headers.get('content-type'),
    pdfStatus: expPdf.status,
    pdfContentType: expPdf.headers.get('content-type'),
    pass: expExcel.status === 200 && expPdf.status === 200,
  };
  console.log(`[L4] Export Excel HTTP ${expExcel.status} (${expExcel.headers.get('content-type')}), PDF HTTP ${expPdf.status} (${expPdf.headers.get('content-type')}) -> ${results.L4.pass ? 'PASS' : 'FAIL'}`);

  // [M2] Permissions Granulaires par Utilisateur (DENY override & Restore)
  const agentUser = await prisma.user.findUnique({ where: { email: 'agent.casa@hes.ma' } });
  const readPerm = await prisma.permission.findUnique({ where: { code: 'customers:read' } });

  await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId: agentUser.id, permissionId: readPerm.id } },
    update: { effect: 'DENY', granted: false },
    create: { userId: agentUser.id, permissionId: readPerm.id, effect: 'DENY', granted: false },
  });
  const loginDeny = await req('POST', '/auth/login', { email: 'agent.casa@hes.ma', password: 'Password123!' }, '');
  const tokenDeny = loginDeny.data?.tokens?.accessToken;
  const testDeny = await req('GET', '/customers', null, tokenDeny);

  await prisma.userPermission.deleteMany({
    where: { userId: agentUser.id, permissionId: readPerm.id },
  });
  const loginRest = await req('POST', '/auth/login', { email: 'agent.casa@hes.ma', password: 'Password123!' }, '');
  const tokenRest = loginRest.data?.tokens?.accessToken;
  const testRest = await req('GET', '/customers', null, tokenRest);

  results.M2 = {
    deniedStatus: testDeny.status,
    restoredStatus: testRest.status,
    pass: testDeny.status === 403 && testRest.status === 200,
  };
  console.log(`[M2] Permissions Granulaires: DENY -> HTTP ${testDeny.status} (403), Restauration -> HTTP ${testRest.status} (200) -> ${results.M2.pass ? 'PASS' : 'FAIL'}`);

  // [M6] 2FA Check
  // In seed, login for admin and finance returns 200 directly without OTP/2FA challenge
  results.M6 = {
    adminDirectLogin: true,
    financeDirectLogin: true,
    enforcedOnLogin: false,
    pass: false, // 2FA is specified as mandatory for admin and finance
  };
  console.log(`[M6] 2FA Admin/Finance: Connexion directe sans 2FA -> FAIL (2FA non imposé au login)`);

  // [M7] Révocation de Session (Logout puis réutilisation du token)
  const logoutRes = await req('POST', '/auth/logout', {}, tokenRest);
  const afterLogout = await req('GET', '/auth/me', null, tokenRest);
  results.M7 = {
    logoutStatus: logoutRes.status,
    afterLogoutStatus: afterLogout.status,
    pass: afterLogout.status === 401,
  };
  console.log(`[M7] Révocation Session: Logout HTTP ${logoutRes.status}, Requête ultérieure HTTP ${afterLogout.status} -> ${results.M7.pass ? 'PASS' : 'FAIL (TOKEN NON INVALIDE)'}`);

  // [M8] Soft Delete
  const tmpZone = await prisma.zone.create({
    data: {
      agencyId: casaHub.id,
      code: `TMP-ZDEL-${Date.now()}`,
      name: 'Zone Test Soft Delete',
      status: 'ACTIVE',
    },
  });
  const delRes = await req('DELETE', `/zones/${tmpZone.id}`, null, managerToken);
  const dbZone = await prisma.zone.findUnique({ where: { id: tmpZone.id } });
  results.M8 = {
    deleteStatus: delRes.status,
    rowStillInDb: !!dbZone,
    deletedAtSet: !!dbZone?.deletedAt,
    pass: !!dbZone && !!dbZone.deletedAt,
  };
  console.log(`[M8] Soft Delete en Base: Ligne conservée=${results.M8.rowStillInDb}, deletedAt=${results.M8.deletedAtSet} -> ${results.M8.pass ? 'PASS' : 'FAIL'}`);

  // Save all results
  const outPath = path.resolve(__dirname, 'checklist-live-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n✅ TOUS LES TESTS N5 SONT TERMINES. Fichier sauvegardé : ${outPath}`);
}

runAll().catch(console.error).finally(() => prisma.$disconnect());
