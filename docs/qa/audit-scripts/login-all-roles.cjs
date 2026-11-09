const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api/v1';
const defaultPassword = 'Password123!';

const seedAccounts = [
  { roleName: 'admin', email: 'admin@hes.ma', roleCode: 'ADMIN' },
  { roleName: 'responsable logistique', email: 'manager@hes.ma', roleCode: 'MANAGER' },
  { roleName: 'agent agence casa', email: 'agent.casa@hes.ma', roleCode: 'AGENT' },
  { roleName: 'agent agence rabat', email: 'agent.rabat@hes.ma', roleCode: 'AGENT' },
  { roleName: 'agent collecte / dispatcher', email: 'dispatcher@hes.ma', roleCode: 'DISPATCHER' },
  { roleName: 'livreur', email: 'courier@hes.ma', roleCode: 'COURIER' },
  { roleName: 'comptable', email: 'finance@hes.ma', roleCode: 'FINANCE' },
  { roleName: 'support', email: 'support@hes.ma', roleCode: 'SUPPORT' },
  { roleName: 'client', email: 'client@shop.ma', roleCode: 'CUSTOMER_SERVICE' },
];

async function loginUser(account) {
  const url = `${API_BASE}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Audit-Agent/1.0',
    },
    body: JSON.stringify({
      email: account.email,
      password: defaultPassword,
    }),
  });

  const status = res.status;
  const data = await res.json();
  return { status, data };
}

async function main() {
  console.log('=== LOGGING IN ALL SEED ROLES VIA HTTP ===\n');

  const tokens = {};
  const reportLines = [];
  let networkFailure = false;

  for (const acc of seedAccounts) {
    try {
      const { status, data } = await loginUser(acc);
      const token = data.tokens ? data.tokens.accessToken : data.accessToken;
      if (status === 200 && token) {
        tokens[acc.email] = {
          token,
          roleName: acc.roleName,
          roleCode: acc.roleCode,
          user: data.user,
        };
        reportLines.push(`[${status} OK] Role: ${acc.roleName.padEnd(25)} Email: ${acc.email.padEnd(20)} 2FA: NON (Accès direct) Permissions: ${data.user.permissions ? data.user.permissions.length : 0}`);
      } else {
        reportLines.push(`[${status} FAIL] Role: ${acc.roleName} Email: ${acc.email} Error: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      networkFailure = true;
      reportLines.push(`[ERROR] Role: ${acc.roleName} Email: ${acc.email} Exception: ${err.message}`);
    }
  }

  console.log(reportLines.join('\n'));

  if (networkFailure) {
    throw new Error('Network failure detected; tokens.json was not overwritten.');
  }

  const tokenFilePath = path.resolve(__dirname, 'tokens.json');
  fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log(`\n✅ Saved ${Object.keys(tokens).length} valid tokens to ${tokenFilePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
