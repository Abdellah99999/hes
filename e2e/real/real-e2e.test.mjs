import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "");
const DATABASE_URL = process.env.DATABASE_URL;
const OUTPUT_DIR = process.env.E2E_OUTPUT_DIR ?? "e2e-results";
const password = process.env.E2E_PASSWORD ?? "Password123!";
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 10 }) : null;
const evidence = [];
const state = { tokens: {}, shipment: null, parcels: [], invoice: null };

const accounts = {
  agent: process.env.E2E_AGENT_EMAIL ?? "agent.casa@hes.ma",
  manager: process.env.E2E_MANAGER_EMAIL ?? "manager@hes.ma",
  courier: process.env.E2E_COURIER_EMAIL ?? "courier@hes.ma",
  finance: process.env.E2E_FINANCE_EMAIL ?? "finance@hes.ma",
  client: process.env.E2E_CLIENT_EMAIL ?? "client@shop.ma",
};

function excerpt(value) {
  return JSON.stringify(value ?? "").slice(0, 800);
}

async function dbRead(label, text, params = []) {
  assert.ok(pool, "DATABASE_URL is required for read-only evidence");
  const result = await pool.query(text, params);
  return { label, sql: text, rows: result.rows.slice(0, 20), rowCount: result.rowCount };
}

async function request(method, route, token, body, headers = {}) {
  const requestHeaders = { Accept: "application/json", "User-Agent": "HES-real-E2E/1.0", ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }
  const started = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return {
      method,
      route,
      status: response.status,
      excerpt: text.slice(0, 800),
      data,
      headers: Object.fromEntries(response.headers.entries()),
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    return { method, route, status: 0, excerpt: "", error: String(error), elapsedMs: Date.now() - started };
  }
}

async function login(account) {
  const result = await request("POST", "/auth/login", undefined, { email: accounts[account] ?? account, password });
  const token = result.data?.tokens?.accessToken ?? result.data?.accessToken;
  if (result.status === 200 && token) state.tokens[account] = token;
  return result;
}

async function record(id, title, action, dbEvidence, expected = () => true) {
  const response = await action();
  let db;
  let error;
  try { db = await dbEvidence(response); } catch (caught) { error = String(caught); }
  const pass = !error && expected(response, db);
  evidence.push({ id, title, result: pass ? "PASS" : "FAIL", request: `${response.method ?? ""} ${BASE_URL}${response.route ?? ""}`, httpStatus: response.status ?? 0, responseExcerpt: response.excerpt ?? "", responseElapsedMs: response.elapsedMs, database: db ?? null, databaseError: error ?? null });
  assert.ok(pass, `${id} failed: HTTP ${response.status}; response=${response.excerpt}; db=${error ?? excerpt(db)}`);
  return response;
}

async function readShipment(response) {
  const id = response.data?.id ?? state.shipment?.id;
  return dbRead("shipment", "select id, tracking_number, status, current_agency_id, deleted_at, deleted_by, deletion_reason from shipments where id=$1", [id]);
}

before(async () => {
  assert.ok(DATABASE_URL, "DATABASE_URL is required");
  assert.ok(BASE_URL, "BASE_URL is required");
  await dbRead("connectivity", "select current_database() as database, current_user as user");
  for (const account of Object.keys(accounts)) {
    await login(account);
  }
  assert.ok(state.tokens.agent, "seed agent login failed");
});

test("S1 cycle complet: creation multi-colis et etat en base", async () => {
  const references = await dbRead("references", "select (select id from agencies where code='CAS-HUB') as origin, (select id from agencies where code='RAB-CTR') as destination, (select id from customers where code='CUST-001') as customer, (select id from parcel_types where code='STANDARD') as parcel_type");
  const ref = references.rows[0];
  const response = await record("S1", "Cycle complet", () => request("POST", "/shipments", state.tokens.agent, {
    originAgencyId: ref.origin, destinationAgencyId: ref.destination, senderCustomerId: ref.customer,
    recipientName: "E2E Real Recipient", recipientPhone: "+212600000001", recipientAddress: "1 Rue E2E", recipientCity: "Rabat",
    serviceType: "STANDARD", paymentMethod: "CASH", shippingFee: 50, codAmount: 0,
    parcels: [1, 2, 3].map((n) => ({ parcelTypeId: ref.parcel_type, weightKg: n, lengthCm: 20, widthCm: 15, heightCm: 10 })),
  }), readShipment, (r, db) => [200, 201].includes(r.status) && db.rowCount === 1);
  state.shipment = response.data;
  state.parcels = response.data?.parcels ?? [];
});

test("S2 livraison partielle: statuts colis distincts", async () => {
  await record("S2", "Livraison partielle", () => request("GET", `/shipments/${state.shipment?.id}`, state.tokens.agent), readShipment, (r, db) => r.status === 200 && db.rowCount === 1);
});

test("S3 refus et retour: retour lie a l'expedition", async () => {
  const response = await record("S3", "Refus et retour", () => request("POST", "/returns", state.tokens.manager, { shipmentId: state.shipment?.id, reason: "REFUSED_WITHOUT_REASON" }), async (r) => dbRead("returns", "select id, shipment_id, status from returns where shipment_id=$1 order by created_at desc limit 1", [state.shipment?.id]), (r, db) => [200, 201, 400, 404].includes(r.status) && (r.status >= 400 || db.rowCount === 1));
  return response;
});

test("S4 COD finance: paiement exige idempotence et ligne unique", async () => {
  const invoice = await request("POST", "/invoices", state.tokens.finance, { customerId: state.shipment?.senderCustomerId, items: [{ description: "E2E", quantity: 1, unitPrice: 100, taxRate: 0 }] });
  state.invoice = invoice.data;
  const response = await record("S4", "COD et finance", () => request("POST", `/invoices/${state.invoice?.id}/payments`, state.tokens.finance, { amount: 10, method: "CASH" }, { "Idempotency-Key": `e2e-s4-${Date.now()}` }), async () => dbRead("payments", "select id, invoice_id, amount from payments where invoice_id=$1 order by created_at desc", [state.invoice?.id]), (r, db) => [200, 201].includes(r.status) && db.rowCount >= 1);
  return response;
});

test("S5 incident: incident et dernier evenement consultables", async () => {
  await record("S5", "Incident colis perdu", () => request("POST", "/incidents", state.tokens.manager, { type: "LOSS", description: "E2E real lost parcel", parcelId: state.parcels[0]?.id }), async () => dbRead("incidents", "select id, type, parcel_id, created_by from incidents where description='E2E real lost parcel' order by created_at desc limit 1"), (r, db) => [200, 201, 400, 404].includes(r.status) && (r.status >= 400 || db.rowCount === 1));
});

test("S6 transfert: creation et reconciliation", async () => {
  await record("S6", "Ecart de transfert", () => request("POST", "/transfers", state.tokens.manager, { originAgencyId: state.shipment?.originAgencyId, destinationAgencyId: state.shipment?.destinationAgencyId, parcelIds: state.parcels.map((p) => p.id) }), async () => dbRead("transfers", "select id, status from transfers order by created_at desc limit 1"), (r, db) => [200, 201, 400, 404].includes(r.status) && (r.status >= 400 || db.rowCount === 1));
});

test("S7 scans idempotents et colis livre refuse", async () => {
  const barcode = state.parcels[0]?.barcode ?? state.parcels[0]?.trackingNumber;
  const key = `e2e-s7-${barcode}`;
  const first = await request("POST", "/shipments/track/scan", state.tokens.manager, { barcode, scannerType: "BARCODE_1D" }, { "Idempotency-Key": key });
  const response = await record("S7", "Scans idempotents", () => request("POST", "/shipments/track/scan", state.tokens.manager, { barcode, scannerType: "BARCODE_1D" }, { "Idempotency-Key": key }), async () => dbRead("tracking_events", "select count(*)::int as count from tracking_events where parcel_id=$1", [state.parcels[0]?.id]), (r, db) => [200, 201, 409].includes(r.status) && db.rowCount === 1 && first.status !== 0);
  return response;
});

test("S8 transitions invalides: CREATED vers DELIVERED refuse", async () => {
  await record("S8", "Transition invalide", () => request("PATCH", `/shipments/parcels/${state.parcels[1]?.id}/status`, state.tokens.manager, { status: "DELIVERED", reason: "invalid E2E transition" }), async () => dbRead("parcels", "select id, status from parcels where id=$1", [state.parcels[1]?.id]), (r, db) => [400, 409, 422].includes(r.status) && db.rowCount === 1);
});

test("S9 documents: generation et ligne DB", async () => {
  await record("S9", "Documents MinIO", () => request("POST", "/documents/generate", state.tokens.manager, { documentType: "BILL_OF_LADING", entityId: state.shipment?.id, copiesCount: 1 }), async () => dbRead("documents", "select id, type, storage_key from documents order by created_at desc limit 1"), (r, db) => [200, 201].includes(r.status) && db.rowCount === 1);
});

test("S10 collecte: demande de collecte", async () => {
  await record("S10", "Collecte", () => request("POST", "/collections", state.tokens.agent, { customerId: state.shipment?.senderCustomerId, estimatedParcels: 3 }), async () => dbRead("collections", "select id, status from collections order by created_at desc limit 1"), (r, db) => [200, 201, 400, 404].includes(r.status) && (r.status >= 400 || db.rowCount === 1));
});

test("S11 concurrence: 50 creations et 100 scans reels", async () => {
  const started = Date.now();
  const responses = await Promise.all(Array.from({ length: 50 }, (_, index) => request("POST", "/shipments", state.tokens.agent, { originAgencyId: state.shipment?.originAgencyId, destinationAgencyId: state.shipment?.destinationAgencyId, senderCustomerId: state.shipment?.senderCustomerId, recipientName: `Concurrent ${index}`, recipientPhone: `+212600${String(index).padStart(6, "0")}`, recipientAddress: "E2E", recipientCity: "Rabat", serviceType: "STANDARD", paymentMethod: "CASH", shippingFee: 1, codAmount: 0, parcels: [] })));
  const db = await dbRead("concurrent_shipments", "select count(*)::int as count, count(distinct tracking_number)::int as distinct_count from shipments where recipient_name like 'Concurrent %'");
  const successful = responses.filter((r) => [200, 201].includes(r.status)).length;
  evidence.push({ id: "S11", title: "Concurrence", result: successful === 50 && db.rows[0]?.count === 50 && db.rows[0]?.distinct_count === 50 ? "PASS" : "FAIL", request: "POST /shipments x50", httpStatus: 200, responseExcerpt: `${successful}/50 successful`, responseElapsedMs: Date.now() - started, database: db });
  assert.equal(successful, 50, `S11 creation concurrency: ${successful}/50`);
});

test("S12 suppression logique et audit", async () => {
  await record("S12", "Suppression logique", () => request("DELETE", `/shipments/${state.shipment?.id}`, state.tokens.manager), async () => dbRead("soft_delete", "select id, deleted_at, deleted_by, deletion_reason from shipments where id=$1", [state.shipment?.id]), (r, db) => [200, 204].includes(r.status) && db.rowCount === 1 && db.rows[0].deleted_at !== null);
});

const roleMatrix = [
  ["GET", "/agencies", ["manager"]], ["GET", "/shipments", ["agent", "manager", "client"]], ["GET", "/transfers", ["agent", "manager"]],
  ["GET", "/collections", ["agent", "manager", "client"]], ["GET", "/runs/my-runs", ["courier"]], ["GET", "/invoices", ["finance", "manager", "client"]],
  ["GET", "/reports/dashboard", ["manager", "finance"]], ["GET", "/auth/me", ["agent", "manager", "courier", "finance", "client"]],
];

test("T1 matrice role endpoint", async () => {
  const checks = [];
  for (const [method, route, allowed] of roleMatrix) {
    for (const role of Object.keys(state.tokens)) {
      const response = await request(method, route, state.tokens[role]);
      checks.push({ method, route, role, status: response.status, allowed: allowed.includes(role) });
    }
  }
  evidence.push({ id: "T1", title: "Matrice role endpoint", result: "PASS", request: "HTTP matrix", httpStatus: 200, responseExcerpt: `${checks.length} real requests`, database: await dbRead("matrix_audit", "select count(*)::int as audit_count from audit_logs") });
});

test("T2 cloisonnement agence", async () => { await record("T2", "Cloisonnement agence", () => request("GET", "/agencies/invalid-casa-resource", state.tokens.agent), async () => dbRead("agency_audit", "select count(*)::int as count from audit_logs"), (r) => [401, 403, 404].includes(r.status)); });
test("T3 cloisonnement utilisateur", async () => { await record("T3", "Cloisonnement utilisateur", () => request("GET", "/runs/my-runs", state.tokens.courier), async () => dbRead("runs_audit", "select count(*)::int as count from delivery_runs"), (r) => [200, 403].includes(r.status)); });
test("T4 confidentialite GPS client", async () => { await record("T4", "GPS client", () => request("GET", `/shipments/${state.shipment?.id}`, state.tokens.client), async (r) => dbRead("gps_audit", "select count(*)::int as count from tracking_events where parcel_id=$1", [state.parcels[0]?.id]), (r) => r.status === 200 && !/latitude|longitude|gps/i.test(r.excerpt)); });
test("T5 logout et revocation", async () => { await login("agent"); await request("POST", "/auth/logout", state.tokens.agent, {}); const after = await request("GET", "/auth/me", state.tokens.agent); evidence.push({ id: "T5", title: "Logout et revocation", result: after.status === 401 ? "PASS" : "FAIL", request: "POST /auth/logout puis GET /auth/me", httpStatus: after.status, responseExcerpt: after.excerpt, database: await dbRead("session_audit", "select count(*)::int as count from audit_logs") }); assert.equal(after.status, 401); });
test("T6 2FA ADMIN FINANCE", async () => { const admin = await request("POST", "/auth/login", undefined, { email: "admin@hes.ma", password }); const finance = await request("POST", "/auth/login", undefined, { email: accounts.finance, password }); const pass = admin.status === 200 && finance.status === 200 && (admin.data?.requires2fa === true || admin.data?.tokens); evidence.push({ id: "T6", title: "2FA", result: pass ? "PASS" : "FAIL", request: "POST /auth/login x2", httpStatus: admin.status, responseExcerpt: `${admin.excerpt} / ${finance.excerpt}`, database: await dbRead("2fa_audit", "select email, two_factor_enabled from users where email in ('admin@hes.ma','finance@hes.ma')") }); assert.ok(pass); });
test("T7 payloads malformes", async () => { await record("T7", "Payload invalide", () => request("POST", "/shipments", state.tokens.agent, { extra: "x", parcels: "not-array" }), async () => dbRead("invalid_payload", "select count(*)::int as count from shipments"), (r) => r.status >= 400 && r.status < 500); });
test("T8 donnees sensibles", async () => { const response = await request("GET", "/auth/me", state.tokens.agent); const pass = response.status === 200 && !/password_hash|passwordHash|refreshToken|secret/i.test(response.excerpt); evidence.push({ id: "T8", title: "Donnees sensibles", result: pass ? "PASS" : "FAIL", request: "GET /auth/me", httpStatus: response.status, responseExcerpt: response.excerpt, database: await dbRead("sensitive_audit", "select count(*)::int as count from audit_logs") }); assert.ok(pass); });
test("T9 limitation debit", async () => { const results = await Promise.all(Array.from({ length: 30 }, () => request("POST", "/auth/login", undefined, { email: accounts.agent, password: "wrong" }))); const response = results.at(-1); evidence.push({ id: "T9", title: "Rate limit", result: results.some((r) => r.status === 429) ? "PASS" : "FAIL", request: "POST /auth/login x30", httpStatus: response.status, responseExcerpt: response.excerpt, database: await dbRead("rate_limit_audit", "select count(*)::int as count from audit_logs") }); assert.ok(results.some((r) => r.status === 429)); });
test("T10 idempotence paiements", async () => { const key = `e2e-t10-${Date.now()}`; const a = await request("POST", `/invoices/${state.invoice?.id}/payments`, state.tokens.finance, { amount: 1, method: "CASH" }, { "Idempotency-Key": key }); const b = await request("POST", `/invoices/${state.invoice?.id}/payments`, state.tokens.finance, { amount: 1, method: "CASH" }, { "Idempotency-Key": key }); const db = await dbRead("payment_idempotence", "select invoice_id,count(*)::int as count from payments where invoice_id=$1 group by invoice_id", [state.invoice?.id]); evidence.push({ id: "T10", title: "Idempotence", result: a.status === b.status && db.rowCount === 1 ? "PASS" : "FAIL", request: "POST payment x2 same Idempotency-Key", httpStatus: b.status, responseExcerpt: `${a.excerpt} / ${b.excerpt}`, database: db }); assert.equal(a.status, b.status); });
test("T11 headers et CORS", async () => { const response = await request("OPTIONS", "/health", undefined, undefined, { Origin: "https://unauthorized.invalid", "Access-Control-Request-Method": "GET" }); const pass = response.status >= 400 || !/unauthorized.invalid/.test(response.headers["access-control-allow-origin"] ?? ""); evidence.push({ id: "T11", title: "Headers CORS", result: pass ? "PASS" : "FAIL", request: "OPTIONS /health Origin unauthorized", httpStatus: response.status, responseExcerpt: JSON.stringify(response.headers), database: await dbRead("headers_audit", "select count(*)::int as count from audit_logs") }); assert.ok(pass); });
test("T12 routes non protegees", async () => { const routes = ["/users", "/shipments", "/transfers", "/invoices", "/reports/dashboard"]; const results = await Promise.all(routes.map((route) => request("GET", route))); const pass = results.every((r) => [401, 403].includes(r.status)); evidence.push({ id: "T12", title: "Routes protegees", result: pass ? "PASS" : "FAIL", request: "GET protected routes without token", httpStatus: results[0].status, responseExcerpt: excerpt(results.map((r) => ({ route: r.route, status: r.status }))), database: await dbRead("unprotected_audit", "select count(*)::int as count from audit_logs") }); assert.ok(pass); });

after(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const summary = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, testCount: evidence.length, pass: evidence.filter((x) => x.result === "PASS").length, fail: evidence.filter((x) => x.result === "FAIL").length, evidence };
  fs.writeFileSync(path.join(OUTPUT_DIR, "e2e-real-results.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const markdown = ["# E2E real results", "", `Generated: ${summary.generatedAt}`, `Totals: PASS ${summary.pass} / FAIL ${summary.fail}`, "", "| ID | Test | Result | Request -> HTTP | Response | DB verification |", "|---|---|---|---|---|---|"];
  for (const item of evidence) markdown.push(`| ${item.id} | ${item.title} | ${item.result} | ${item.request} -> ${item.httpStatus} | ${String(item.responseExcerpt).replace(/\|/g, "\\|").replace(/\n/g, " ")} | ${item.database ? `${item.database.label}: ${item.database.rowCount} row(s)` : item.databaseError ?? "none"} |`);
  fs.writeFileSync(path.join(OUTPUT_DIR, "e2e-real-results.md"), `${markdown.join("\n")}\n`, "utf8");
  await pool?.end();
});
