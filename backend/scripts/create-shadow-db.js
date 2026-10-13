const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe('CREATE DATABASE delivery_shadow;');
    console.log('delivery_shadow created successfully');
  } catch (e) {
    console.log('Shadow DB info:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
