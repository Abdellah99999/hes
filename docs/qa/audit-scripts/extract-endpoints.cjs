const fs = require('fs');
const path = require('path');

async function main() {
  const res = await fetch('http://localhost:3000/api/v1/docs-json');
  const openapi = await res.json();
  const lines = [];

  for (const [routePath, methods] of Object.entries(openapi.paths)) {
    for (const [method, details] of Object.entries(methods)) {
      const tags = (details.tags || []).join(', ');
      const isProtected = details.security && details.security.length > 0;
      const secStr = isProtected ? 'PROTECTED' : 'PUBLIC';
      const summary = details.summary || details.operationId || '';
      lines.push(`${method.toUpperCase().padEnd(7)} /api/v1${routePath.padEnd(50)} [${secStr.padEnd(9)}] [${tags}] ${summary}`);
    }
  }

  lines.sort();
  const outPath = path.resolve(__dirname, 'endpoints.txt');
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
  console.log(`Generated ${lines.length} live endpoints in ${outPath}`);
}

main().catch(console.error);
