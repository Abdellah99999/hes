import {
  PrismaClient,
  PermissionModule,
  PermissionAction,
  RoleCode,
} from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();
const defaultPassword = "Password123!";

async function hashPassword(plain: string) {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function main() {
  console.log("🌱 Executing official HES seed...");

  // 1. Cities
  const casaCity = await prisma.city.upsert({
    where: { code: "CAS" },
    update: { name: "Casablanca", country: "MA" },
    create: { code: "CAS", name: "Casablanca", country: "MA" },
  });

  const rabatCity = await prisma.city.upsert({
    where: { code: "RAB" },
    update: { name: "Rabat", country: "MA" },
    create: { code: "RAB", name: "Rabat", country: "MA" },
  });

  // 2. Agencies
  const casaHub = await prisma.agency.upsert({
    where: { code: "CAS-HUB" },
    update: {
      name: "Agence Casablanca Hub",
      city: "Casablanca",
      cityId: casaCity.id,
      status: "ACTIVE",
      isActive: true,
    },
    create: {
      code: "CAS-HUB",
      name: "Agence Casablanca Hub",
      city: "Casablanca",
      cityId: casaCity.id,
      address: "Route de Nouaceur, Casablanca",
      phone: "+212522001122",
      email: "casahub@hes.ma",
      status: "ACTIVE",
      isActive: true,
    },
  });

  const casaMaarif = await prisma.agency.upsert({
    where: { code: "CAS-MAA" },
    update: {
      name: "Agence Casablanca Maârif",
      city: "Casablanca",
      cityId: casaCity.id,
      status: "ACTIVE",
      isActive: true,
    },
    create: {
      code: "CAS-MAA",
      name: "Agence Casablanca Maârif",
      city: "Casablanca",
      cityId: casaCity.id,
      address: "45 Rue Jean Jaurès, Maârif, Casablanca",
      phone: "+212522334455",
      email: "maarif@hes.ma",
      status: "ACTIVE",
      isActive: true,
    },
  });

  const rabatAgency = await prisma.agency.upsert({
    where: { code: "RAB-CTR" },
    update: {
      name: "Agence Rabat Centre",
      city: "Rabat",
      cityId: rabatCity.id,
      status: "ACTIVE",
      isActive: true,
    },
    create: {
      code: "RAB-CTR",
      name: "Agence Rabat Centre",
      city: "Rabat",
      cityId: rabatCity.id,
      address: "12 Avenue Mohammed V, Rabat",
      phone: "+212537112233",
      email: "rabat@hes.ma",
      status: "ACTIVE",
      isActive: true,
    },
  });

  // 3. Zones
  const zoneCasa1 = await prisma.zone.upsert({
    where: { agencyId_code: { agencyId: casaHub.id, code: "CAS-Z01" } },
    update: { name: "Zone Ain Sebaa / Bernoussi", cityId: casaCity.id },
    create: {
      agencyId: casaHub.id,
      code: "CAS-Z01",
      name: "Zone Ain Sebaa / Bernoussi",
      cityId: casaCity.id,
    },
  });

  await prisma.zone.upsert({
    where: { agencyId_code: { agencyId: casaMaarif.id, code: "CAS-Z02" } },
    update: { name: "Zone Maârif / Gauthier", cityId: casaCity.id },
    create: {
      agencyId: casaMaarif.id,
      code: "CAS-Z02",
      name: "Zone Maârif / Gauthier",
      cityId: casaCity.id,
    },
  });

  await prisma.zone.upsert({
    where: { agencyId_code: { agencyId: rabatAgency.id, code: "RAB-Z01" } },
    update: { name: "Zone Agdal / Hassan", cityId: rabatCity.id },
    create: {
      agencyId: rabatAgency.id,
      code: "RAB-Z01",
      name: "Zone Agdal / Hassan",
      cityId: rabatCity.id,
    },
  });

  // 4. Parcel Types & Package Types
  const parcelTypes = [
    { code: "STANDARD", name: "Colis Standard", description: "Colis standard jusqu'à 30kg" },
    { code: "EXPRESS", name: "Colis Express", description: "Colis express prioritaire" },
    { code: "DOCUMENT", name: "Document / Pli", description: "Courrier et enveloppe" },
    { code: "PALLET", name: "Palette", description: "Fret lourd sur palette" },
    { code: "FRAGILE", name: "Colis Fragile", description: "Manutention délicate requise" },
  ];
  for (const pt of parcelTypes) {
    await prisma.parcelType.upsert({
      where: { code: pt.code },
      update: { name: pt.name, description: pt.description },
      create: pt,
    });
  }

  const packageTypes = [
    { code: "STANDARD", name: "Carton Standard", description: "Emballage carton standard" },
    { code: "DOCUMENT", name: "Pli / Pochette", description: "Enveloppe sécurisée" },
    { code: "PALLET", name: "Palette Bois / Plastique", description: "Support palette logistique" },
    { code: "PARCEL", name: "Petit Paquet", description: "Petit colis e-commerce" },
    { code: "BOX", name: "Boîte Renforcée", description: "Caisse rigide protégée" },
  ];
  for (const pk of packageTypes) {
    await prisma.packageType.upsert({
      where: { code: pk.code },
      update: { name: pk.name, description: pk.description },
      create: pk,
    });
  }

  // 5. Services
  const services = [
    { code: "STANDARD", name: "Livraison Standard", description: "Livraison normale J+1/J+2" },
    { code: "EXPRESS", name: "Livraison Express", description: "Livraison urgente sous 24h" },
    { code: "SAME_DAY", name: "Livraison Même Jour", description: "Livraison ultra-rapide le jour même" },
    { code: "ECONOMIC", name: "Livraison Économique", description: "Livraison sous 48h-72h à tarif réduit" },
  ];
  for (const s of services) {
    await prisma.service.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description, isActive: true },
      create: s,
    });
  }

  // 6. Refusal Reasons
  const refusalReasons = [
    { code: "DAMAGED_PACKAGE", labelFr: "Colis endommagé ou avarié", labelAr: "طرد تالف أو متضرر" },
    { code: "CONTENT_MISMATCH", labelFr: "Contenu non conforme à la commande", labelAr: "المحتوى غير مطابق للطلب" },
    { code: "COD_AMOUNT_DISPUTED", labelFr: "Montant CRBT / COD contesté", labelAr: "المبلغ المطلوب متنازع عليه" },
    { code: "ORDER_CANCELLED", labelFr: "Commande annulée par le client", labelAr: "الطلب ملغى من طرف الزبون" },
    { code: "REFUSED_WITHOUT_REASON", labelFr: "Refus de réception sans motif", labelAr: "رفض الاستلام بدون سبب" },
    { code: "FRAUD_SUSPECTED", labelFr: "Suspicion de fraude ou fausse identité", labelAr: "اشتباه في احتيال" },
  ];
  for (const rr of refusalReasons) {
    await prisma.refusalReason.upsert({
      where: { code: rr.code },
      update: { labelFr: rr.labelFr, labelAr: rr.labelAr },
      create: rr,
    });
  }

  // 7. Customer Types
  const b2bType = await prisma.customerType.upsert({
    where: { code: "ENTERPRISE" },
    update: { name: "Grande Entreprise B2B" },
    create: { code: "ENTERPRISE", name: "Grande Entreprise B2B" },
  });

  await prisma.customerType.upsert({
    where: { code: "INDIVIDUAL" },
    update: { name: "Particulier B2C" },
    create: { code: "INDIVIDUAL", name: "Particulier B2C" },
  });

  // 8. Permissions
  const permissionsData: Array<{
    code: string;
    module: PermissionModule;
    action: PermissionAction;
    name: string;
  }> = [
    { code: "*", module: "AUTH", action: "EXPORT", name: "Super Admin All" },
    { code: "agencies:read", module: "AGENCY", action: "READ", name: "Lire agences" },
    { code: "agencies:manage", module: "AGENCY", action: "CREATE", name: "Gérer agences" },
    { code: "agencies:cross_view", module: "AGENCY", action: "READ", name: "Vue inter-agences" },
    { code: "all_agencies:read", module: "AGENCY", action: "READ", name: "Lire toutes agences" },
    { code: "zones:read", module: "AGENCY", action: "READ", name: "Lire zones" },
    { code: "zones:manage", module: "AGENCY", action: "CREATE", name: "Gérer zones" },
    { code: "customers:read", module: "CUSTOMER", action: "READ", name: "Lire clients" },
    { code: "customers:manage", module: "CUSTOMER", action: "CREATE", name: "Gérer clients" },
    { code: "customers:assign", module: "CUSTOMER", action: "UPDATE", name: "Assigner gestionnaire client" },
    { code: "addresses:read", module: "CUSTOMER", action: "READ", name: "Lire adresses" },
    { code: "addresses:create", module: "CUSTOMER", action: "CREATE", name: "Créer adresses" },
    { code: "addresses:manage", module: "CUSTOMER", action: "UPDATE", name: "Gérer adresses" },
    { code: "shipments:read", module: "SHIPMENT", action: "READ", name: "Lire expéditions" },
    { code: "shipments:create", module: "SHIPMENT", action: "CREATE", name: "Créer expédition" },
    { code: "shipments:update", module: "SHIPMENT", action: "UPDATE", name: "Modifier expédition" },
    { code: "transfers:read", module: "TRANSFER", action: "READ", name: "Lire transferts" },
    { code: "transfers:create", module: "TRANSFER", action: "CREATE", name: "Créer transferts" },
    { code: "transfers:update", module: "TRANSFER", action: "UPDATE", name: "Mettre à jour transferts" },
    { code: "collections:read", module: "COLLECTION", action: "READ", name: "Lire collectes" },
    { code: "collections:create", module: "COLLECTION", action: "CREATE", name: "Créer collecte" },
    { code: "collections:manage", module: "COLLECTION", action: "UPDATE", name: "Gérer collectes" },
    { code: "deliveries:read", module: "DELIVERY", action: "READ", name: "Lire livraisons" },
    { code: "deliveries:manage", module: "DELIVERY", action: "PROCESS", name: "Gérer livraisons" },
    { code: "deliveries:confirm", module: "DELIVERY", action: "PROCESS", name: "Confirmer livraison" },
    { code: "deliveries:refuse", module: "DELIVERY", action: "PROCESS", name: "Refuser livraison" },
    { code: "runs:read", module: "DELIVERY", action: "READ", name: "Lire tournées" },
    { code: "runs:manage", module: "DELIVERY", action: "DISPATCH", name: "Gérer tournées" },
    { code: "couriers:manage", module: "DELIVERY", action: "DISPATCH", name: "Gérer livreurs" },
    { code: "returns:read", module: "RETURN", action: "READ", name: "Lire retours" },
    { code: "returns:manage", module: "RETURN", action: "PROCESS", name: "Gérer retours" },
    { code: "returns:recover", module: "RETURN", action: "PROCESS", name: "Récupérer retours" },
    { code: "incidents:read", module: "INCIDENT", action: "READ", name: "Lire incidents" },
    { code: "incidents:manage", module: "INCIDENT", action: "PROCESS", name: "Gérer incidents" },
    { code: "incidents:create", module: "INCIDENT", action: "CREATE", name: "Créer incident" },
    { code: "invoices:read", module: "FINANCE", action: "READ", name: "Lire factures" },
    { code: "invoices:manage", module: "FINANCE", action: "CREATE", name: "Gérer factures" },
    { code: "billing:manage", module: "FINANCE", action: "CREATE", name: "Facturation et finances" },
    { code: "payments:manage", module: "FINANCE", action: "PROCESS", name: "Gérer paiements" },
    { code: "documents:generate", module: "DOCUMENT", action: "CREATE", name: "Générer documents" },
    { code: "documents:download", module: "DOCUMENT", action: "EXPORT", name: "Télécharger documents" },
    { code: "reports:view", module: "REPORT", action: "READ", name: "Voir rapports" },
    { code: "reports:export", module: "REPORT", action: "EXPORT", name: "Exporter rapports" },
    { code: "users:read", module: "AUTH", action: "READ", name: "Lire utilisateurs" },
    { code: "users:manage", module: "AUTH", action: "CREATE", name: "Gérer utilisateurs" },
    { code: "referentials:read", module: "AGENCY", action: "READ", name: "Lire référentiels" },
    { code: "referentials:manage", module: "AGENCY", action: "CREATE", name: "Gérer référentiels" },
  ];

  const permMap: Record<string, string> = {};
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, module: p.module, action: p.action },
      create: p,
    });
    permMap[p.code] = perm.id;
  }

  // 9. Roles & Permissions mapping
  const allPermCodes = permissionsData.map((p) => p.code);
  const rolesConfig: Array<{ code: RoleCode; name: string; perms: string[] }> = [
    { code: "ADMIN", name: "Administrateur", perms: allPermCodes },
    { code: "SUPER_ADMIN", name: "Super Administrateur", perms: allPermCodes },
    {
      code: "MANAGER",
      name: "Responsable Logistique",
      perms: [
        "agencies:read", "agencies:cross_view", "all_agencies:read",
        "zones:read", "zones:manage", "customers:read", "customers:manage", "customers:assign",
        "referentials:read",
        "addresses:read", "addresses:create", "addresses:manage",
        "shipments:read", "shipments:create", "shipments:update",
        "transfers:read", "transfers:create", "transfers:update",
        "collections:read", "collections:create", "collections:manage",
        "runs:read", "runs:manage", "couriers:manage",
        "deliveries:read", "deliveries:manage", "deliveries:confirm", "deliveries:refuse",
        "returns:read", "returns:manage", "returns:recover",
        "incidents:read", "incidents:manage", "incidents:create",
        "invoices:read",
        "documents:generate", "documents:download",
        "reports:view", "reports:export"
      ],
    },
    {
      code: "AGENT",
      name: "Agent Agence",
      perms: [
        "zones:read", "customers:read", "customers:manage",
        "referentials:read",
        "addresses:read", "addresses:create", "addresses:manage",
        "shipments:read", "shipments:create", "shipments:update",
        "transfers:read", "transfers:create", "transfers:update",
        "collections:read", "collections:create", "collections:manage",
        "deliveries:read",
        "returns:read", "returns:manage", "returns:recover",
        "incidents:create",
        "invoices:read",
        "documents:generate", "documents:download"
      ],
    },
    {
      code: "DISPATCHER",
      name: "Agent Collecte / Dispatcher",
      perms: [
        "zones:read",
        "shipments:read",
        "collections:read", "collections:create", "collections:manage",
        "runs:manage",
        "deliveries:read"
      ],
    },
    {
      code: "COURIER",
      name: "Livreur",
      perms: [
        "runs:read",
        "deliveries:read", "deliveries:confirm", "deliveries:refuse",
        "returns:recover",
        "collections:manage",
        "incidents:create"
      ],
    },
    {
      code: "FINANCE",
      name: "Comptable",
      perms: [
        "invoices:read", "invoices:manage", "billing:manage", "payments:manage",
        "customers:read",
        "referentials:read",
        "reports:view", "reports:export",
        "documents:generate", "documents:download"
      ],
    },
    {
      code: "SUPPORT",
      name: "Support Client",
      perms: [
        "shipments:read",
        "customers:read",
        "deliveries:read",
        "incidents:read", "incidents:manage", "incidents:create",
        "reports:view"
      ],
    },
    {
      code: "CUSTOMER_SERVICE",
      name: "Client Portail",
      perms: [
        "shipments:read",
        "collections:read", "collections:create",
        "invoices:read",
        "addresses:read", "addresses:create",
        "documents:download"
      ],
    },
  ];

  const roleDbMap: Record<RoleCode, { id: string; code: RoleCode }> = {} as Record<
    RoleCode,
    { id: string; code: RoleCode }
  >;
  for (const r of rolesConfig) {
    const roleRecord = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name, description: `Rôle ${r.name}` },
    });
    roleDbMap[r.code] = roleRecord;

    await prisma.rolePermission.deleteMany({
      where: { roleId: roleRecord.id },
    });

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

  // 10. Demo Customer
  const customerRecord = await prisma.customer.upsert({
    where: { code: "CUST-001" },
    update: {},
    create: {
      code: "CUST-001",
      agencyId: casaHub.id,
      cityId: casaCity.id,
      zoneId: zoneCasa1.id,
      legalName: "Acme Maroc SARL",
      tradeName: "Acme Express",
      ice: "001524367000089",
      taxId: "IF-987654321",
      rc: "RC-CAS-12345",
      phone: "+212522998877",
      email: "contact@acme.ma",
      status: "ACTIVE",
      customerTypeId: b2bType.id,
    },
  });

  await prisma.customerContact.upsert({
    where: { id: "contact-acme-1" },
    update: {},
    create: {
      id: "contact-acme-1",
      customerId: customerRecord.id,
      firstName: "Tariq",
      lastName: "Berrada",
      phone: "+212661223344",
      email: "tariq@acme.ma",
      role: "Responsable Logistique",
      isPrimary: true,
    },
  });

  await prisma.address.upsert({
    where: { id: "addr-acme-1" },
    update: {},
    create: {
      id: "addr-acme-1",
      title: "Siège Social Acme",
      label: "Siège Acme",
      street: "Boulevard Abdelmoumen, Immeuble B, 4e étage",
      city: "Casablanca",
      postalCode: "20100",
      type: "BUSINESS",
      customerId: customerRecord.id,
      agencyId: casaHub.id,
      zoneId: zoneCasa1.id,
    },
  });

  // 11. Demo Users per Role
  const passwordHash = await hashPassword(defaultPassword);

  const usersConfig: Array<{
    email: string;
    firstName: string;
    lastName: string;
    roleCode: RoleCode;
    agencyId: string;
    customerId?: string;
  }> = [
    { email: "admin@hes.ma", firstName: "Reda", lastName: "Admin", roleCode: "ADMIN", agencyId: casaHub.id },
    { email: "manager@hes.ma", firstName: "Omar", lastName: "Directeur", roleCode: "MANAGER", agencyId: casaHub.id },
    { email: "agent.casa@hes.ma", firstName: "Amina", lastName: "AgentCasa", roleCode: "AGENT", agencyId: casaHub.id },
    { email: "agent.rabat@hes.ma", firstName: "Hassan", lastName: "AgentRabat", roleCode: "AGENT", agencyId: rabatAgency.id },
    { email: "dispatcher@hes.ma", firstName: "Yassine", lastName: "Collecte", roleCode: "DISPATCHER", agencyId: casaHub.id },
    { email: "courier@hes.ma", firstName: "Karim", lastName: "Livreur", roleCode: "COURIER", agencyId: casaHub.id },
    { email: "finance@hes.ma", firstName: "Khadija", lastName: "Comptable", roleCode: "FINANCE", agencyId: casaHub.id },
    { email: "support@hes.ma", firstName: "Sara", lastName: "Support", roleCode: "SUPPORT", agencyId: casaHub.id },
    { email: "client@shop.ma", firstName: "Mehdi", lastName: "ClientTazi", roleCode: "CUSTOMER_SERVICE", agencyId: casaHub.id, customerId: customerRecord.id },
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
        status: "ACTIVE",
        isActive: true,
      },
    });
  }

  // 12. Courier Profile
  const courierUser = await prisma.user.findUnique({ where: { email: "courier@hes.ma" } });
  if (courierUser) {
    await prisma.courierProfile.upsert({
      where: { userId: courierUser.id },
      update: {},
      create: {
        userId: courierUser.id,
        agencyId: casaHub.id,
        vehicleType: "MOTORCYCLE",
        vehiclePlate: "12345-A-6",
        maxDailyParcels: 40,
        isActive: true,
      },
    });
  }

  console.log("✅ Official seed completed successfully!");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌ Seed error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
