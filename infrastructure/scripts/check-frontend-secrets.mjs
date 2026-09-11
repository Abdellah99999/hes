import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../../frontend/dist');

const FORBIDDEN_PATTERNS = [
  /hes_secure_dev_password/i,
  /hes_redis_dev_password/i,
  /hes_minio_secret_key/i,
  /hes_jwt_access_secret/i,
  /hes_jwt_refresh_secret/i,
  /DATABASE_URL/i,
  /REDIS_PASSWORD/i,
  /MINIO_SECRET_KEY/i,
  /JWT_ACCESS_SECRET/i,
  /postgresql:\/\//i
];

console.log('🔒 Inspecting frontend build bundle for secret leaks...');

if (!fs.existsSync(distDir)) {
  console.error(`❌ Build directory not found: ${distDir}. Please build the frontend first.`);
  process.exit(1);
}

function scanDir(dir) {
  let foundViolations = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      foundViolations = foundViolations.concat(scanDir(fullPath));
    } else if (/\.(js|css|html|map)$/i.test(file)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          foundViolations.push({
            file: fullPath,
            pattern: pattern.toString()
          });
        }
      }
    }
  }

  return foundViolations;
}

const violations = scanDir(distDir);

if (violations.length > 0) {
  console.error('🚨 SECURITY VIOLATION: Backend secrets detected in frontend build artifacts!');
  violations.forEach((v) => {
    console.error(`  - File: ${v.file} matched pattern ${v.pattern}`);
  });
  process.exit(1);
} else {
  console.log('✅ CLEAN: No backend secrets or forbidden sensitive variables found in frontend bundle.');
  process.exit(0);
}
