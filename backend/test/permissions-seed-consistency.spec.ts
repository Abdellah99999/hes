import * as fs from "fs";
import * as path from "path";

describe("P1 - Permissions Seed Consistency Test", () => {
  const modulesDir = path.resolve(__dirname, "../src/modules");
  const seedFile = path.resolve(__dirname, "../prisma/seed.ts");

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

  it("should ensure every permission used in @RequirePermissions exists in prisma/seed.ts", () => {
    const controllers = findControllers(modulesDir);
    const usedPermissions = new Set<string>();

    for (const ctrl of controllers) {
      const content = fs.readFileSync(ctrl, "utf8");
      const regex = /@RequirePermissions\(([^)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const permString = match[1].replace(/['"\s]/g, "");
        const perms = permString.split(",");
        for (const p of perms) {
          if (p) {
            usedPermissions.add(p);
          }
        }
      }
    }

    const seedContent = fs.readFileSync(seedFile, "utf8");
    const missingPermissions: string[] = [];

    for (const perm of usedPermissions) {
      const hasDoubleQuote = seedContent.includes(`"${perm}"`);
      const hasSingleQuote = seedContent.includes(`'${perm}'`);
      if (!hasDoubleQuote && !hasSingleQuote) {
        missingPermissions.push(perm);
      }
    }

    expect(missingPermissions).toEqual([]);
    expect(usedPermissions.size).toBeGreaterThanOrEqual(40);
  });
});
