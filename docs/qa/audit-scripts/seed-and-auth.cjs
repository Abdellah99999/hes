const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');
const argon2 = require('../../../backend/node_modules/argon2');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const defaultPassword = 'Password123!';

async function hashPassword(plain) {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  console.log('--- SEEDING AUDIT DATABASE ---');

  // 1. Cities
  const casaCity = await prisma.city.upsert({
    where: { code: 'CAS' },
    update: {},
    create: { code: 'CAS', name: 'Casablanca', country: 'MA' },
  });

  const rabatCity = await prisma.city.upsert({
    where: { code: 'RAB' },
    update: {},
    create: { code: 'RAB', name: 'Rabat', country: 'MA' },
  });

  // 2. Agencies (including 2 in same city: CAS-HUB and CAS-MAA)
  const casaHub = await prisma.agency.upsert({
    where: { code: 'CAS-HUB' },
    update: {},
    create: {
      code: 'CAS-HUB',
      name: 'Agence Casablanca Hub',
      city: 'Casablanca',
      cityId: casaCity.id,
      address: 'Route de Nouaceur, Casablanca',
      phone: '+212522001122',
      email: 'casahub@hes.ma',
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const casaMaarif = await prisma.agency.upsert({
    where: { code: 'CAS-MAA' },
    update: {},
    create: {
      code: 'CAS-MAA',
      name: 'Agence Casablanca Maârif',
      city: 'Casablanca',
      cityId: casaCity.id,
      address: '45 Rue Jean Jaurès, Maârif, Casablanca',
      phone: '+212522334455',
      email: 'maarif@hes.ma',
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const rabatAgency = await prisma.agency.upsert({
    where: { code: 'RAB-CTR' },
    update: {},
    create: {
      code: 'RAB-CTR',
      name: 'Agence Rabat Centre',
      city: 'Rabat',
      cityId: rabatCity.id,
      address: '12 Avenue Mohammed V, Rabat',
      phone: '+212537112233',
      email: 'rabat@hes.ma',
      status: 'ACTIVE',
      isActive: true,
    },
  });

  console.log('✅ Agencies created: CAS-HUB, CAS-MAA, RAB-CTR');

  // 3. Zones
  const zoneCasa1 = await prisma.zone.upsert({
    where: { agencyId_code: { agencyId: casaHub.id, code: 'CAS-Z01' } },
    update: {},
    create: {
      agencyId: casaHub.id,
      code: 'CAS-Z01',
      name: 'Zone Ain Sebaa / Bernoussi',
      cityId: casaCity.id,
    },
  });

  const zoneCasa2 = await prisma.zone.upsert({
    where: { agencyId_code: { agencyId: casaMaarif.id, code: 'CAS-Z02' } },
    update: {},
    create: {
      agencyId: casaMaarif.id,
      code: 'CAS-Z02',
      name: 'Zone Maârif / Gauthier',
      cityId: casaCity.id,
    },
  });

  const zoneRabat = await prisma.zone.upsert({
    where: { agencyId_code: { agencyId: rabatAgency.id, code: 'RAB-Z01' } },
    update: {},
    create: {
      agencyId: rabatAgency.id,
      code: 'RAB-Z01',
      name: 'Zone Agdal / Hassan',
      cityId: rabatCity.id,
    },
  });

  // 4. Permissions List
  const permissionsData = [
    { code: '*', module: 'AUTH', action: 'EXPORT', name: 'Super Admin All' },
    { code: 'agencies:read', module: 'AGENCY', action: 'READ', name: 'Lire agences' },
    { code: 'agencies:manage', module: 'AGENCY', action: 'CREATE', name: 'Gérer agences' },
    { code: 'agencies:cross_view', module: 'AGENCY', action: 'READ', name: 'Vue inter-agences' },
    { code: 'all_agencies:read', module: 'AGENCY', action: 'READ', name: 'Lire toutes agences' },
    { code: 'zones:read', module: 'AGENCY', action: 'READ', name: 'Lire zones' },
    { code: 'zones:manage', module: 'AGENCY', action: 'CREATE', name: 'Gérer zones' },
    { code: 'customers:read', module: 'CUSTOMER', action: 'READ', name: 'Lire clients' },
    { code: 'customers:manage', module: 'CUSTOMER', action: 'CREATE', name: 'Gérer clients' },
    { code: 'shipments:read', module: 'SHIPMENT', action: 'READ', name: 'Lire expéditions' },
    { code: 'shipments:create', module: 'SHIPMENT', action: 'CREATE', name: 'Créer expédition' },
    { code: 'shipments:update', module: 'SHIPMENT', action: 'UPDATE', name: 'Modifier expédition' },
    { code: 'transfers:read', module: 'TRANSFER', action: 'READ', name: 'Lire transferts' },
    { code: 'transfers:create', module: 'TRANSFER', action: 'CREATE', name: 'Créer transferts' },
    { code: 'transfers:update', module: 'TRANSFER', action: 'UPDATE', name: 'Mettre à jour transferts' },
    { code: 'collections:read', module: 'COLLECTION', action: 'READ', name: 'Lire collectes' },
    { code: 'collections:create', module: 'COLLECTION', action: 'CREATE', name: 'Créer collecte' },
    { code: 'collections:manage', module: 'COLLECTION', action: 'UPDATE', name: 'Gérer collectes' },
    { code: 'deliveries:read', module: 'DELIVERY', action: 'READ', name: 'Lire livraisons' },
    { code: 'deliveries:confirm', module: 'DELIVERY', action: 'PROCESS', name: 'Confirmer livraison' },
    { code: 'deliveries:refuse', module: 'DELIVERY', action: 'PROCESS', name: 'Refuser livraison' },
    { code: 'runs:read', module: 'DELIVERY', action: 'READ', name: 'Lire tournées' },
    { code: 'runs:manage', module: 'DELIVERY', action: 'DISPATCH', name: 'Gérer tournées' },
    { code: 'couriers:manage', module: 'DELIVERY', action: 'DISPATCH', name: 'Gérer livreurs' },
    { code: 'returns:read', module: 'RETURN', action: 'READ', name: 'Lire retours' },
    { code: 'returns:manage', module: 'RETURN', action: 'PROCESS', name: 'Gérer retours' },
    { code: 'incidents:read', module: 'INCIDENT', action: 'READ', name: 'Lire incidents' },
    { code: 'incidents:manage', module: 'INCIDENT', action: 'PROCESS', name: 'Gérer incidents' },
    { code: 'invoices:read', module: 'FINANCE', action: 'READ', name: 'Lire factures' },
    { code: 'invoices:manage', module: 'FINANCE', action: 'CREATE', name: 'Gérer factures' },
    { code: 'payments:manage', module: 'FINANCE', action: 'PROCESS', name: 'Gérer paiements' },
    { code: 'documents:generate', module: 'DOCUMENT', action: 'CREATE', name: 'Générer documents' },
    { code: 'documents:download', module: 'DOCUMENT', action: 'EXPORT', name: 'Télécharger documents' },
    { code: 'reports:view', module: 'REPORT', action: 'READ', name: 'Voir rapports' },
    { code: 'reports:export', module: 'REPORT', action: 'EXPORT', name: 'Exporter rapports' },
    { code: 'users:read', module: 'AUTH', action: 'READ', name: 'Lire utilisateurs' },
    { code: 'users:manage', module: 'AUTH', action: 'CREATE', name: 'Gérer utilisateurs' },
  ];

  const permMap = {};
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    permMap[p.code] = perm.id;
  }

  // 5. Roles & RolePermissions
  const allPermCodes = permissionsData.map(p => p.code);
  const rolesConfig = [
    { code: 'ADMIN', name: 'Administrateur', perms: allPermCodes },
    { code: 'SUPER_ADMIN', name: 'Super Administrateur', perms: allPermCodes },
    { code: 'MANAGER', name: 'Responsable Logistique', perms: ['agencies:read', 'agencies:cross_view', 'all_agencies:read', 'zones:read', 'zones:manage', 'customers:read', 'customers:manage', 'shipments:read', 'shipments:create', 'shipments:update', 'transfers:read', 'transfers:create', 'transfers:update', 'collections:read', 'collections:manage', 'runs:read', 'runs:manage', 'couriers:manage', 'deliveries:read', 'returns:read', 'returns:manage', 'incidents:read', 'incidents:manage', 'invoices:read', 'documents:generate', 'documents:download', 'reports:view', 'reports:export', 'users:read'] },
    { code: 'AGENT', name: 'Agent Agence', perms: ['zones:read', 'customers:read', 'customers:manage', 'shipments:read', 'shipments:create', 'shipments:update', 'transfers:read', 'transfers:create', 'transfers:update', 'collections:read', 'collections:create', 'deliveries:read', 'returns:read', 'incidents:read', 'invoices:read', 'documents:generate', 'documents:download'] },
    { code: 'DISPATCHER', name: 'Agent Collecte / Dispatcher', perms: ['collections:read', 'collections:create', 'collections:manage', 'runs:read', 'runs:manage', 'shipments:read', 'deliveries:read', 'zones:read'] },
    { code: 'COURIER', name: 'Livreur', perms: ['runs:read', 'deliveries:confirm', 'deliveries:refuse', 'returns:manage', 'collections:read', 'incidents:manage'] },
    { code: 'FINANCE', name: 'Comptable', perms: ['invoices:read', 'invoices:manage', 'payments:manage', 'customers:read', 'reports:view', 'reports:export', 'documents:generate', 'documents:download'] },
    { code: 'SUPPORT', name: 'Support Client', perms: ['shipments:read', 'customers:read', 'incidents:read', 'incidents:manage', 'invoices:read', 'reports:view'] },
    { code: 'CUSTOMER_SERVICE', name: 'Client Portail', perms: ['collections:create', 'collections:read', 'shipments:read', 'invoices:read', 'documents:download'] },
  ];

  const roleDbMap = {};
  for (const r of rolesConfig) {
    const roleRecord = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name, description: `Rôle ${r.name}` },
    });
    roleDbMap[r.code] = roleRecord;

    // Link role permissions
    for (const permCode of r.perms) {
      const permId = permMap[permCode];
      if (permId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: roleRecord.id, permissionId: permId } },
          update: {},
          create: { roleId: roleRecord.id, permissionId: permId },
        });
      }
    }
  }
  console.log('✅ Roles and RolePermissions created');

  // 5b. Parcel Types & Services
  const standardParcelType = await prisma.parcelType.upsert({
    where: { code: 'STANDARD' },
    update: {},
    create: { code: 'STANDARD', name: 'Colis Standard', description: 'Colis standard jusqu à 30kg' },
  });
  await prisma.parcelType.upsert({
    where: { code: 'DOCUMENT' },
    update: {},
    create: { code: 'DOCUMENT', name: 'Document / Pli', description: 'Courrier et enveloppe' },
  });
  await prisma.parcelType.upsert({
    where: { code: 'PALLET' },
    update: {},
    create: { code: 'PALLET', name: 'Palette', description: 'Fret sur palette' },
  });
  console.log('✅ ParcelTypes created');

  // 6. CustomerType & Customer
  const b2bType = await prisma.customerType.upsert({
    where: { code: 'ENTERPRISE' },
    update: {},
    create: { code: 'ENTERPRISE', name: 'Grande Entreprise B2B' },
  });

  const b2cType = await prisma.customerType.upsert({
    where: { code: 'INDIVIDUAL' },
    update: {},
    create: { code: 'INDIVIDUAL', name: 'Particulier B2C' },
  });

  const customerRecord = await prisma.customer.upsert({
    where: { code: 'CUST-001' },
    update: {},
    create: {
      code: 'CUST-001',
      agencyId: casaHub.id,
      cityId: casaCity.id,
      zoneId: zoneCasa1.id,
      legalName: 'Acme Maroc SARL',
      tradeName: 'Acme Express',
      ice: '001524367000089',
      taxId: 'IF-987654321',
      rc: 'RC-CAS-12345',
      phone: '+212522998877',
      email: 'contact@acme.ma',
      status: 'ACTIVE',
      customerTypeId: b2bType.id,
    },
  });

  // Customer Contact
  await prisma.customerContact.upsert({
    where: { id: 'contact-acme-1' },
    update: {},
    create: {
      id: 'contact-acme-1',
      customerId: customerRecord.id,
      firstName: 'Tariq',
      lastName: 'Berrada',
      phone: '+212661223344',
      email: 'tariq@acme.ma',
      role: 'Responsable Logistique',
      isPrimary: true,
    },
  });

  // Address
  await prisma.address.upsert({
    where: { id: 'addr-acme-1' },
    update: {},
    create: {
      id: 'addr-acme-1',
      title: 'Siège Social Acme',
      label: 'Siège Acme',
      street: 'Boulevard Abdelmoumen, Immeuble B, 4e étage',
      city: 'Casablanca',
      postalCode: '20100',
      type: 'BUSINESS',
      customerId: customerRecord.id,
      agencyId: casaHub.id,
      zoneId: zoneCasa1.id,
    },
  });

  // 7. Users for each role
  const passwordHash = await hashPassword(defaultPassword);

  const usersConfig = [
    { email: 'admin@hes.ma', firstName: 'Reda', lastName: 'Admin', roleCode: 'ADMIN', agencyId: casaHub.id },
    { email: 'manager@hes.ma', firstName: 'Omar', lastName: 'Directeur', roleCode: 'MANAGER', agencyId: casaHub.id },
    { email: 'agent.casa@hes.ma', firstName: 'Amina', lastName: 'AgentCasa', roleCode: 'AGENT', agencyId: casaHub.id },
    { email: 'agent.rabat@hes.ma', firstName: 'Hassan', lastName: 'AgentRabat', roleCode: 'AGENT', agencyId: rabatAgency.id },
    { email: 'dispatcher@hes.ma', firstName: 'Yassine', lastName: 'Collecte', roleCode: 'DISPATCHER', agencyId: casaHub.id },
    { email: 'courier@hes.ma', firstName: 'Karim', lastName: 'Livreur', roleCode: 'COURIER', agencyId: casaHub.id },
    { email: 'finance@hes.ma', firstName: 'Khadija', lastName: 'Comptable', roleCode: 'FINANCE', agencyId: casaHub.id },
    { email: 'support@hes.ma', firstName: 'Sara', lastName: 'Support', roleCode: 'SUPPORT', agencyId: casaHub.id },
    { email: 'client@shop.ma', firstName: 'Mehdi', lastName: 'ClientTazi', roleCode: 'CUSTOMER_SERVICE', agencyId: casaHub.id, customerId: customerRecord.id },
  ];

  for (const u of usersConfig) {
    const roleDb = roleDbMap[u.roleCode];
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        roleId: roleDb.id,
        agencyId: u.agencyId,
        customerId: u.customerId || null,
        isActive: true,
        passwordHash,
      },
      create: {
        email: u.email,
        fullName: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        roleId: roleDb.id,
        agencyId: u.agencyId,
        customerId: u.customerId || null,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  // Courier profile for courier user
  const courierUser = await prisma.user.findUnique({ where: { email: 'courier@hes.ma' } });
  if (courierUser) {
    await prisma.courierProfile.upsert({
      where: { userId: courierUser.id },
      update: {},
      create: {
        userId: courierUser.id,
        agencyId: casaHub.id,
        vehicleType: 'MOTORCYCLE',
        vehiclePlate: '12345-A-6',
        maxDailyParcels: 40,
        isActive: true,
      },
    });
  }

  console.log('✅ All 9 seed users and courier profiles created successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
