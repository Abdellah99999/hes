const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api/v1';

async function main() {
  const tokens = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'tokens.json'), 'utf-8'));
  const managerToken = tokens['manager@hes.ma'].token;
  const adminToken = tokens['admin@hes.ma'].token;

  const casaHub = await prisma.agency.findUnique({ where: { code: 'CAS-HUB' } });
  const rabatAgency = await prisma.agency.findUnique({ where: { code: 'RAB-CTR' } });
  const cust = await prisma.customer.findUnique({ where: { code: 'CUST-001' } });
  const parcelType = await prisma.parcelType.findFirst({ where: { code: 'STANDARD' } });

  console.log('--- TEST C1: CREATING SHIPMENT ---');
  const payload = {
    originAgencyId: casaHub.id,
    destinationAgencyId: rabatAgency.id,
    senderCustomerId: cust.id,
    recipientName: 'Société Maghreb Distribution',
    recipientPhone: '+212661889900',
    recipientAddress: '25 Boulevard Hassan II',
    recipientCity: 'Rabat',
    serviceType: 'STANDARD',
    paymentMethod: 'CASH',
    shippingFee: 60.00,
    codAmount: 450.00,
    declaredValue: 800.00,
    parcels: [
      {
        parcelTypeId: parcelType.id,
        weightKg: 2.5,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
      },
      {
        parcelTypeId: parcelType.id,
        weightKg: 1.2,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
      }
    ]
  };

  const res = await fetch(`${API_BASE}/shipments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${managerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  const status = res.status;
  const data = await res.json();
  console.log('HTTP Status:', status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (status === 201) {
    const shipmentId = data.id || data.shipment?.id;
    const trackingNumber = data.trackingNumber || data.shipment?.trackingNumber;
    console.log(`✅ Shipment created successfully! ID=${shipmentId}, TrackingNumber=${trackingNumber}`);

    // Verify DB
    const dbShipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { parcels: true, items: true, trackingEvents: true }
    });
    console.log('DB Record found:', !!dbShipment);
    console.log('DB Parcels count:', dbShipment?.parcels?.length);
    console.log('DB Status:', dbShipment?.status);
    console.log('DB Events count:', dbShipment?.events?.length);
  }
}

main().finally(() => prisma.$disconnect());
