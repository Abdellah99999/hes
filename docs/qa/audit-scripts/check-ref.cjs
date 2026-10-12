const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pts = await prisma.parcelType.findMany();
  console.log('ParcelTypes count:', pts.length);
  console.log(pts);
  const svcs = await prisma.service.findMany();
  console.log('Services count:', svcs.length);
  console.log(svcs);
}

main().finally(() => prisma.$disconnect());
