import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as http from "http";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TotpService } from "../src/modules/auth/services/totp.service";
import { UsersService } from "../src/modules/users/users.service";

describe("Priorité 2 — Sessions et 2FA (Real PostgreSQL & Real Redis)", () => {
  let app: INestApplication;
  let server: http.Server;
  let baseUrl: string;
  let prisma: PrismaService;
  let totpService: TotpService;
  let usersService: UsersService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    server = app.getHttpServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    prisma = app.get<PrismaService>(PrismaService);
    totpService = app.get<TotpService>(TotpService);
    usersService = app.get<UsersService>(UsersService);

    // Reset 2FA status for admin and finance before tests
    await prisma.user.updateMany({
      where: { email: { in: ["admin@hes.ma", "finance@hes.ma"] } },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }, 30000);

  afterAll(async () => {
    // Reset 2FA back to false to avoid breaking external test suites
    await prisma.user.updateMany({
      where: { email: { in: ["admin@hes.ma", "finance@hes.ma"] } },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await app.close();
  });

  describe("1. Gestion des Sessions & Révocation Immédiate (Redis + JWT)", () => {
    it("devrait inclure un sessionId dans le JWT et renvoyer 401 après logout", async () => {
      // 1. Login user without 2FA requirement
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "agent.casa@hes.ma",
          password: "Password123!",
        }),
      });

      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      const accessToken = loginData.tokens.accessToken;
      expect(accessToken).toBeDefined();

      // Decode JWT payload (without verification, just to check payload format)
      const payloadBase64 = accessToken.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
      expect(payload.sessionId).toBeDefined();
      expect(typeof payload.sessionId).toBe("string");

      // 2. Access protected endpoint before logout -> 200 OK
      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(meRes.status).toBe(200);

      // 3. Perform logout
      const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(logoutRes.status).toBe(200);

      // 4. Access protected endpoint AFTER logout with the SAME token -> 401 UNAUTHORIZED
      const meAfterLogout = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(meAfterLogout.status).toBe(401);
      const errData = await meAfterLogout.json();
      expect(errData.message).toContain("Session révoquée");
    });

    it("devrait refuser l'accès avec 401 immédiatement lorsqu'un admin révoque la session", async () => {
      // 1. Courier logs in
      const courierLoginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "courier@hes.ma",
          password: "Password123!",
        }),
      });
      const courierData = await courierLoginRes.json();
      const courierToken = courierData.tokens.accessToken;

      // Extract sessionId
      const payload = JSON.parse(
        Buffer.from(courierToken.split(".")[1], "base64").toString("utf-8"),
      );
      const sessionId = payload.sessionId;
      expect(sessionId).toBeDefined();

      // Verify active access
      const activeRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${courierToken}` },
      });
      expect(activeRes.status).toBe(200);

      // 2. Admin revokes courier session
      const courierUser = await prisma.user.findUnique({
        where: { email: "courier@hes.ma" },
      });
      await usersService.revokeUserSession(courierUser!.id, sessionId);

      // 3. Courier tries to access with token -> 401 Unauthorized
      const revokedRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${courierToken}` },
      });
      expect(revokedRes.status).toBe(401);
      const err = await revokedRes.json();
      expect(err.message).toContain("Session révoquée");
    });
  });

  describe("2. 2FA Obligatoire pour ADMIN et COMPTABLE (FINANCE)", () => {
    let adminEnrollmentSecret: string;
    let adminRestrictedToken: string;

    it("Étape 2.1 (Admin Non-Enrôlé) : login délivre un jeton restreint qui ne peut accéder qu'aux routes 2FA", async () => {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@hes.ma",
          password: "Password123!",
        }),
      });

      expect(loginRes.status).toBe(200);
      const data = await loginRes.json();
      expect(data.requires2fa).toBe(true);
      expect(data.twoFactorEnrolled).toBe(false);
      expect(data.tokens?.accessToken).toBeDefined();
      adminRestrictedToken = data.tokens.accessToken;

      // Token carries restricted flag
      const payload = JSON.parse(
        Buffer.from(adminRestrictedToken.split(".")[1], "base64").toString("utf-8"),
      );
      expect(payload.isRestricted2fa).toBe(true);

      // Attempting to access standard business endpoints MUST fail with 401
      const usersRes = await fetch(`${baseUrl}/users`, {
        headers: { Authorization: `Bearer ${adminRestrictedToken}` },
      });
      expect(usersRes.status).toBe(401);
      const err = await usersRes.json();
      expect(err.message).toContain("Authentification à deux facteurs requise");
    });

    it("Étape 2.2 (Enrôlement 2FA) : génération du secret TOTP puis validation avec code 6 chiffres", async () => {
      // 1. Call 2FA setup with restricted token
      const setupRes = await fetch(`${baseUrl}/auth/2fa/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminRestrictedToken}` },
      });
      expect(setupRes.status).toBe(200);
      const setupData = await setupRes.json();
      expect(setupData.secret).toBeDefined();
      expect(setupData.otpauthUrl).toContain("otpauth://totp/");
      adminEnrollmentSecret = setupData.secret;

      // 2. Reject wrong code
      const wrongVerifyRes = await fetch(`${baseUrl}/auth/2fa/verify-setup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminRestrictedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: "000000" }),
      });
      expect(wrongVerifyRes.status).toBe(400);

      // 3. Generate correct TOTP code using RFC 6238
      const validCode = totpService.generateCode(adminEnrollmentSecret);

      const verifySetupRes = await fetch(`${baseUrl}/auth/2fa/verify-setup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminRestrictedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: validCode }),
      });

      expect(verifySetupRes.status).toBe(200);
      const verifyData = await verifySetupRes.json();
      expect(verifyData.twoFactorEnrolled).toBe(true);
      expect(verifyData.tokens?.accessToken).toBeDefined();

      // Access business endpoint with full token -> 200 OK
      const fullToken = verifyData.tokens.accessToken;
      const usersRes = await fetch(`${baseUrl}/users`, {
        headers: { Authorization: `Bearer ${fullToken}` },
      });
      expect(usersRes.status).toBe(200);
    });

    it("Étape 2.3 (Admin Enrôlé) : le login exige un code TOTP avant d'émettre les jetons complets", async () => {
      // 1. Login with enrolled admin
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@hes.ma",
          password: "Password123!",
        }),
      });

      expect(loginRes.status).toBe(200);
      const data = await loginRes.json();
      expect(data.requires2fa).toBe(true);
      expect(data.twoFactorEnrolled).toBe(true);
      expect(data.tempToken).toBeDefined();
      expect(data.tokens).toBeUndefined(); // NO full tokens issued yet!

      const tempToken = data.tempToken;

      // 2. Reject invalid code
      const badVerifyRes = await fetch(`${baseUrl}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: "999999" }),
      });
      expect(badVerifyRes.status).toBe(401);

      // 3. Submit valid TOTP code
      const validCode = totpService.generateCode(adminEnrollmentSecret);
      const validVerifyRes = await fetch(`${baseUrl}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: validCode }),
      });

      expect(validVerifyRes.status).toBe(200);
      const completeData = await validVerifyRes.json();
      expect(completeData.tokens?.accessToken).toBeDefined();

      // Check full access
      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${completeData.tokens.accessToken}` },
      });
      expect(meRes.status).toBe(200);
    });

    it("Étape 2.4 (Comptable / FINANCE) : 2FA également obligatoire", async () => {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "finance@hes.ma",
          password: "Password123!",
        }),
      });

      expect(loginRes.status).toBe(200);
      const data = await loginRes.json();
      expect(data.requires2fa).toBe(true);
      expect(data.twoFactorEnrolled).toBe(false);
      expect(data.tokens?.accessToken).toBeDefined();
    });
  });
});
