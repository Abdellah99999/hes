const fs = require('fs');
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[k] = v;
      }
    }
  }
}
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const Minio = require('minio');

async function testServices() {
  console.log('Testing Postgres...');
  try {
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Postgres is UP');
    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Postgres DOWN:', err.message);
  }

  console.log('Testing Redis...');
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    await redis.connect();
    const pong = await redis.ping();
    console.log('✅ Redis is UP, response:', pong);
    await redis.quit();
  } catch (err) {
    console.error('❌ Redis DOWN:', err.message);
  }

  console.log('Testing MinIO...');
  try {
    const minio = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'hes_minio_admin',
      secretKey: process.env.MINIO_SECRET_KEY || 'hes_minio_secret_key_2026',
    });
    const buckets = await minio.listBuckets();
    console.log('✅ MinIO is UP, buckets:', buckets.map(b => b.name));
  } catch (err) {
    console.error('❌ MinIO DOWN:', err.message);
  }
}

testServices();
