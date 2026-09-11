import * as fs from "fs";
import * as path from "path";
import { StructuredLoggerService } from "../src/common/logger/structured-logger.service";
import { CorrelationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { Request, Response } from "express";

describe("Phase 17: OWASP Top 10 Comprehensive Security & Bundle Audit", () => {
  const rootDir = path.resolve(__dirname, "..");
  const repoRootDir = path.resolve(__dirname, "../..");

  // =========================================================================
  // A01: Broken Access Control
  // =========================================================================
  describe("A01: Broken Access Control & Clean Architecture Integrity", () => {
    it("should verify ZERO direct Prisma queries in any NestJS controller (Clean Architecture)", () => {
      const controllersDir = path.join(rootDir, "src", "modules");
      const findControllerFiles = (dir: string): string[] => {
        const files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findControllerFiles(fullPath));
          } else if (entry.name.endsWith(".controller.ts")) {
            files.push(fullPath);
          }
        }
        return files;
      };

      const controllerFiles = findControllerFiles(controllersDir);
      expect(controllerFiles.length).toBeGreaterThan(5);

      const violations: string[] = [];
      for (const file of controllerFiles) {
        const content = fs.readFileSync(file, "utf-8");
        // Direct PrismaService injection or prisma query calls
        if (
          content.includes("PrismaService") ||
          content.includes("this.prisma.")
        ) {
          violations.push(path.basename(file));
        }
      }

      expect(violations).toEqual([]);
    });

    it("should verify agency boundary checks in service and repository queries", () => {
      const repoFile = path.join(
        rootDir,
        "src",
        "modules",
        "shipments",
        "infrastructure",
        "prisma-shipment.repository.ts",
      );
      const content = fs.readFileSync(repoFile, "utf-8");
      expect(content).toContain("verifyShipmentAgencyAccess");
      expect(content).toContain("SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT");
    });
  });

  // =========================================================================
  // A02: Cryptographic Failures & Secret Leakage Prevention
  // =========================================================================
  describe("A02: Cryptographic Failures & Zero Secrets in Frontend Bundle", () => {
    it("should scan compiled frontend JS bundle and verify ZERO backend secrets leaked", () => {
      const distAssetsDir = path.join(repoRootDir, "frontend", "dist", "assets");
      expect(fs.existsSync(distAssetsDir)).toBe(true);

      const jsFiles = fs
        .readdirSync(distAssetsDir)
        .filter((f) => f.endsWith(".js"));
      expect(jsFiles.length).toBeGreaterThan(0);

      const secretPatterns = [
        /JWT_ACCESS_SECRET/i,
        /JWT_REFRESH_SECRET/i,
        /MINIO_SECRET_KEY/i,
        /DATABASE_URL/i,
        /postgresql:\/\/.*:.*@/i,
        /ARGON2_SECRET/i,
        /AIzaSy[0-9A-Za-z-_]{33}/, // Google Cloud API Key format
        /supersecret/i,
      ];

      const detectedLeaks: string[] = [];
      for (const jsFile of jsFiles) {
        const bundleContent = fs.readFileSync(
          path.join(distAssetsDir, jsFile),
          "utf-8",
        );
        for (const pattern of secretPatterns) {
          if (pattern.test(bundleContent)) {
            detectedLeaks.push(`Leak detected with pattern ${pattern} in ${jsFile}`);
          }
        }
      }

      expect(detectedLeaks).toEqual([]);
    });

    it("should ensure .gitignore prevents leaking sensitive .env files", () => {
      const gitignorePath = path.join(repoRootDir, ".gitignore");
      expect(fs.existsSync(gitignorePath)).toBe(true);
      const gitignore = fs.readFileSync(gitignorePath, "utf-8");

      expect(gitignore).toMatch(/\.env(\.local)?/);
    });
  });

  // =========================================================================
  // A03: Injection & Parameterized Data Access
  // =========================================================================
  describe("A03: SQL Injection Immunity", () => {
    it("should verify that no unescaped $queryRawUnsafe is used across backend codebase", () => {
      const srcDir = path.join(rootDir, "src");
      const findFiles = (dir: string): string[] => {
        const files: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findFiles(full));
          } else if (entry.name.endsWith(".ts")) {
            files.push(full);
          }
        }
        return files;
      };

      const allTsFiles = findFiles(srcDir);
      const rawUnsafeUsages: string[] = [];
      for (const file of allTsFiles) {
        const content = fs.readFileSync(file, "utf-8");
        if (content.includes("$queryRawUnsafe") || content.includes("$executeRawUnsafe")) {
          rawUnsafeUsages.push(path.basename(file));
        }
      }

      expect(rawUnsafeUsages).toEqual([]);
    });
  });

  // =========================================================================
  // A04: Insecure Design & Rate Limiting
  // =========================================================================
  describe("A04: Insecure Design & Throttling", () => {
    it("should configure global ThrottlerGuard and rate limiting in AppModule", () => {
      const appModuleFile = path.join(rootDir, "src", "app.module.ts");
      const content = fs.readFileSync(appModuleFile, "utf-8");

      expect(content).toContain("ThrottlerModule.forRoot");
      expect(content).toContain("ThrottlerGuard");
      expect(content).toContain("ttl: 1000"); // 1s short burst
      expect(content).toContain("ttl: 60000"); // 1m sustained
    });
  });

  // =========================================================================
  // A05: Security Misconfiguration & HTTP Headers
  // =========================================================================
  describe("A05: Security Headers & CORS Policy", () => {
    it("should configure Helmet and strict CORS in main.ts", () => {
      const mainFile = path.join(rootDir, "src", "main.ts");
      const content = fs.readFileSync(mainFile, "utf-8");

      expect(content).toContain("helmet()");
      expect(content).toContain("enableCors");
      expect(content).toContain("whitelist: true");
      expect(content).toContain("forbidNonWhitelisted: true");
    });
  });

  // =========================================================================
  // A07: Identification and Authentication Failures
  // =========================================================================
  describe("A07: Strict Token Expiration and Validation", () => {
    it("should configure short-lived access tokens and separate opaque refresh tokens", () => {
      const tokenServiceFile = path.join(
        rootDir,
        "src",
        "modules",
        "auth",
        "services",
        "token.service.ts",
      );
      const content = fs.readFileSync(tokenServiceFile, "utf-8");

      expect(content).toContain('expiresIn: "15m"');
      expect(content).toContain("generateOpaqueToken");
      expect(content).toContain("hashToken");
    });
  });

  // =========================================================================
  // A09: Security Logging and Monitoring (Observability & PII Masking)
  // =========================================================================
  describe("A09: Zero Sensitive Data in Structured Logs", () => {
    let logger: StructuredLoggerService;
    let stdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      logger = new StructuredLoggerService("OWASP-Audit");
      stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it("should strictly redact all credentials, biometric signatures, tokens, and PII from logs", () => {
      const payload = {
        email: "courier@hes.ma",
        password: "ClearTextPassword123!",
        token: "eyJhbGciOi...",
        api_key: "ai-secret-xyz-123",
        signature: "data:image/png;base64,iVBORw0KGgo...",
        recipient_signature: "base64-handwritten-signature",
        cvv: "123",
        card_number: "4111222233334444",
        pin: "9988",
        recipientCin: "BK998877",
        safeTrackingNumber: "HES-CAS-2026-000001",
      };

      logger.log("Dispatching parcel to customer", "Delivery", payload);

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const logLine = stdoutSpy.mock.calls[0][0];
      const parsed = JSON.parse(logLine.trim());

      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.token).toBe("[REDACTED]");
      expect(parsed.api_key).toBe("[REDACTED]");
      expect(parsed.signature).toBe("[REDACTED]");
      expect(parsed.recipient_signature).toBe("[REDACTED]");
      expect(parsed.cvv).toBe("[REDACTED]");
      expect(parsed.card_number).toBe("[REDACTED]");
      expect(parsed.pin).toBe("[REDACTED]");
      expect(parsed.recipientCin).toBe("[REDACTED]");
      expect(parsed.safeTrackingNumber).toBe("HES-CAS-2026-000001");
    });

    it("should propagate both X-Correlation-Id and X-Request-Id across middleware", () => {
      const middleware = new CorrelationIdMiddleware();
      const mockReq = { headers: { "x-correlation-id": "corr-uuid-777" } } as unknown as Request;
      const setHeaderMock = jest.fn();
      const mockRes = { setHeader: setHeaderMock } as unknown as Response;
      const nextFn = jest.fn();

      middleware.use(mockReq, mockRes, nextFn);

      expect(mockReq.correlationId).toBe("corr-uuid-777");
      expect(setHeaderMock).toHaveBeenCalledWith("X-Correlation-Id", "corr-uuid-777");
      expect(setHeaderMock).toHaveBeenCalledWith("X-Request-Id", "corr-uuid-777");
      expect(nextFn).toHaveBeenCalled();
    });
  });
});
