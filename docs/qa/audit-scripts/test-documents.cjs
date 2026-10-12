const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api/v1';

async function main() {
  const tokens = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'tokens.json'), 'utf-8'));
  const managerToken = tokens['manager@hes.ma'].token;

  // Let's test generating documents
  // DocumentType enum in backend: BILL_OF_LADING, PARCEL_LABEL, INVOICE, RECEIPT, COLLECTION_BORDEREAU, TRANSFER_BORDEREAU, DELIVERY_RUN_SHEET, REPORT
  const shipmentId = '7915e68c-d070-4ba5-9f5c-8d0d68ad2e45';

  const typesToTest = [
    { type: 'BILL_OF_LADING', entityId: shipmentId },
    { type: 'PARCEL_LABEL', entityId: shipmentId },
  ];

  for (const t of typesToTest) {
    console.log(`\nTesting document generation for ${t.type}...`);
    const res = await fetch(`${API_BASE}/documents/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentType: t.type,
        entityId: t.entityId,
        copiesCount: 1,
      })
    });

    console.log(`Status for ${t.type}:`, res.status);
    const data = await res.json();
    console.log('Response:', data);

    if (res.status === 201) {
      console.log(`Download URL:`, data.downloadUrl);
      console.log(`MIME Type:`, data.mimeType);
      console.log(`File Name:`, data.fileName);
      console.log(`Document ID:`, data.document?.id);

      // Test download URL via GET
      if (data.document?.id) {
        const dlRes = await fetch(`${API_BASE}/documents/${data.document.id}/download-url`, {
          headers: { 'Authorization': `Bearer ${managerToken}` }
        });
        console.log(`Download URL endpoint status:`, dlRes.status);
      }
    }
  }
}

main().catch(console.error);
