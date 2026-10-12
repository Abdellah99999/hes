const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$executeRawUnsafe('ALTER TABLE shipment_sequences ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
  console.log('ALTER TABLE shipment_sequences result:', res);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
