import * as fs from "fs";
import * as path from "path";

describe("P1 - Guards Coverage Test (Systematic RBAC Scan)", () => {
  const modulesDir = path.resolve(__dirname, "../src/modules");

  // Explicit, documented exceptions for routes that do not require an RBAC permission
  const EXPLICIT_EXCEPTIONS = new Set([
    "POST /api/v1/auth/logout",
    "GET /api/v1/auth/me",
    "POST /api/v1/auth/2fa/setup",
    "POST /api/v1/auth/2fa/verify-setup",
    "GET /api/v1/notifications",
    "PATCH /api/v1/notifications/:id/read",
    "PATCH /api/v1/notifications/read-all",
    "GET /api/v1/health",
  ]);

  function findControllers(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(findControllers(fullPath));
      } else if (item.endsWith(".controller.ts")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it("should fail if any non-@Public route does not have @RequirePermissions, unless explicitly whitelisted", () => {
    const controllers = findControllers(modulesDir);
    const violatingRoutes: Array<{ route: string; file: string }> = [];

    for (const file of controllers) {
      const content = fs.readFileSync(file, "utf8");
      const relPath = path.relative(path.resolve(__dirname, ".."), file);

      const controllerMatch = content.match(/@Controller\(['"]?(.*?)['"]?\)/);
      const controllerPrefix = controllerMatch ? controllerMatch[1] : "";
      const classPermMatch = content.match(/@RequirePermissions\((.*?)\)\s*export\s+class/);

      const methodRegex = /@(Get|Post|Put|Patch|Delete)\((?:['"](.*?)['"])?\)/g;
      let match: RegExpExecArray | null;

      while ((match = methodRegex.exec(content)) !== null) {
        const httpMethod = match[1].toUpperCase();
        const subPath = match[2] || "";
        const fullRoute = `/api/v1/${controllerPrefix}${subPath ? "/" + subPath : ""}`
          .replace(/\/+/g, "/")
          .replace(/\/$/, "");

        const startIndex = Math.max(0, match.index - 500);
        const decoratorSnippet = content.substring(startIndex, match.index + 200);

        const isPublic = decoratorSnippet.includes("@Public()");
        const hasRequirePerm = decoratorSnippet.includes("@RequirePermissions(") || !!classPermMatch;

        const routeSignature = `${httpMethod} ${fullRoute}`;

        if (!isPublic && !hasRequirePerm) {
          if (!EXPLICIT_EXCEPTIONS.has(routeSignature)) {
            violatingRoutes.push({ route: routeSignature, file: relPath });
          }
        }
      }
    }

    if (violatingRoutes.length > 0) {
      console.error("Violating routes without @RequirePermissions:", violatingRoutes);
    }

    expect(violatingRoutes).toEqual([]);
  });
});
