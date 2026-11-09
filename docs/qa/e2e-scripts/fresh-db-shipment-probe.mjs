import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000/api/v1";
const query = async (sql, params = []) => (await pool.query(sql, params)).rows;

const [references] = await query("select (select id from agencies where code='CAS-HUB') as origin, (select id from agencies where code='RAB-CTR') as destination, (select id from customers where code='CUST-001') as customer, (select id from parcel_types where code='STANDARD') as parcel_type");
const login = await fetch(`${baseUrl}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "agent.casa@hes.ma", password: process.env.E2E_PASSWORD ?? "Password123!" }),
});
const loginData = await login.json();
const token = loginData.tokens?.accessToken;
const response = await fetch(`${baseUrl}/shipments`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({
    originAgencyId: references.origin,
    destinationAgencyId: references.destination,
    senderCustomerId: references.customer,
    recipientName: "Fresh DB E2E",
    recipientPhone: "+212600000099",
    recipientAddress: "1 Rue Fresh",
    recipientCity: "Rabat",
    serviceType: "STANDARD",
    paymentMethod: "CASH",
    shippingFee: 10,
    codAmount: 0,
    parcels: [{ parcelTypeId: references.parcel_type, weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
  }),
});
const responseText = await response.text();
const data = JSON.parse(responseText);
const [shipment] = await query("select id, tracking_number, status, current_agency_id from shipments where id=$1", [data.id]);
const [parcels] = await query("select count(*)::int as count from parcels where shipment_id=$1", [data.id]);
console.log(JSON.stringify({ loginHttp: login.status, createHttp: response.status, responseExcerpt: responseText.slice(0, 700), shipment, parcels }));
await pool.end();
