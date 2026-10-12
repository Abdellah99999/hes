const fs = require('fs');
const path = require('path');

const modulesDir = path.resolve(__dirname, '../../../backend/src/modules');

function analyzeControllers() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith('.controller.ts')) files.push(fullPath);
    }
  }
  walk(modulesDir);

  const unprotectedRoutes = [];
  const protectedRoutes = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(path.resolve(__dirname, '../../..'), file);

    // Controller level
    const controllerMatch = content.match(/@Controller\(['"]?(.*?)['"]?\)/);
    const controllerPrefix = controllerMatch ? controllerMatch[1] : '';
    const classHasJwt = content.includes('@UseGuards(JwtAuthGuard') || content.includes('@UseGuards(JwtAuthGuard, PermissionsGuard)');
    const classHasPermGuard = content.includes('PermissionsGuard');
    const classPermMatch = content.match(/@RequirePermissions\((.*?)\)\s*export\s+class/);

    // Split methods
    const methodRegex = /@(Get|Post|Put|Patch|Delete)\((?:['"](.*?)['"])?\)/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const httpMethod = match[1].toUpperCase();
      const subPath = match[2] || '';
      const fullRoute = `/api/v1/${controllerPrefix}${subPath ? '/' + subPath : ''}`.replace(/\/+/g, '/').replace(/\/$/, '');

      // Look back for method decorators
      const startIndex = Math.max(0, match.index - 500);
      const decoratorSnippet = content.substring(startIndex, match.index + 200);

      const isPublic = decoratorSnippet.includes('@Public()');
      const hasRequirePerm = decoratorSnippet.includes('@RequirePermissions(') || !!classPermMatch;
      const permMatch = decoratorSnippet.match(/@RequirePermissions\((.*?)\)/);
      const permName = permMatch ? permMatch[1] : (classPermMatch ? classPermMatch[1] : 'NONE');

      if (isPublic || (!hasRequirePerm && !classPermMatch)) {
        unprotectedRoutes.push({
          file: relPath,
          httpMethod,
          route: fullRoute,
          isPublic,
          hasJwtGuard: classHasJwt && !isPublic,
          hasPermissionGuard: false,
          requiredPermission: null,
        });
      } else {
        protectedRoutes.push({
          file: relPath,
          httpMethod,
          route: fullRoute,
          isPublic: false,
          hasJwtGuard: classHasJwt,
          hasPermissionGuard: true,
          requiredPermission: permName,
        });
      }
    }
  }

  console.log(`Total Routes Analyzed: ${unprotectedRoutes.length + protectedRoutes.length}`);
  console.log(`Routes WITH @RequirePermissions: ${protectedRoutes.length}`);
  console.log(`Routes WITHOUT @RequirePermissions: ${unprotectedRoutes.length}`);

  const out = {
    unprotectedCount: unprotectedRoutes.length,
    protectedCount: protectedRoutes.length,
    unprotectedRoutes,
    protectedRoutes,
  };

  fs.writeFileSync(path.resolve(__dirname, 'routes-analysis.json'), JSON.stringify(out, null, 2), 'utf-8');
}

analyzeControllers();
