const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '../modules');

function findControllers(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findControllers(fullPath));
    } else if (item.endsWith('.controller.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const controllers = findControllers(modulesDir);
const usedPermissions = new Set();
const routePermissions = [];

for (const ctrl of controllers) {
  const content = fs.readFileSync(ctrl, 'utf8');
  const relPath = path.relative(path.join(__dirname, '../../../'), ctrl);
  
  // Find RequirePermissions
  const regex = /@RequirePermissions\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const permString = match[1].replace(/['"\s]/g, '');
    const perms = permString.split(',');
    for (const p of perms) {
      if (p) {
        usedPermissions.add(p);
        routePermissions.push({ file: relPath, perm: p });
      }
    }
  }
}

console.log('--- ALL PERMISSIONS USED IN CONTROLLERS (' + usedPermissions.size + ') ---');
console.log(Array.from(usedPermissions).sort());

// Check against seed.ts
const seedContent = fs.readFileSync(path.join(__dirname, '../../prisma/seed.ts'), 'utf8');
const missingInSeed = [];
for (const p of usedPermissions) {
  if (!seedContent.includes(`"${p}"`) && !seedContent.includes(`'${p}'`)) {
    missingInSeed.push(p);
  }
}

console.log('\n--- MISSING IN SEED.TS (' + missingInSeed.length + ') ---');
console.log(missingInSeed);
