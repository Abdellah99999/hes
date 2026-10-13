const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Dropping and recreating public schema in delivery database...');
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE;');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public;');
  console.log('✅ Schema public is now completely empty.');
}

main()
  .catch((e) => {
    console.error('Error resetting database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
