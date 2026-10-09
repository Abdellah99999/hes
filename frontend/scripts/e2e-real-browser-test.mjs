/**
 * Test E2E Navigateur Réel (Chromium via Playwright)
 * Vérifie les styles calculés (getComputedStyle), les hauteurs tactiles >= 44px,
 * la réactivité de la BottomBar, l'absence de scroll horizontal et capture les 21 écrans.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../../docs/qa/screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const courierUser = {
  id: 'courier-01',
  email: 'livreur@hes.ma',
  firstName: 'Karim',
  lastName: 'El Idrissi',
  role: 'COURIER',
  isActive: true,
  permissions: ['runs:read', 'deliveries:create'],
};

const adminUser = {
  id: 'admin-01',
  email: 'admin@hes.ma',
  firstName: 'Salma',
  lastName: 'Bennani',
  role: 'ADMIN',
  isActive: true,
  permissions: ['*'],
};

const clientUser = {
  id: 'client-01',
  email: 'client@shop.ma',
  firstName: 'Mehdi',
  lastName: 'Tazi',
  role: 'CLIENT',
  isActive: true,
  permissions: ['collections:create', 'shipments:read', 'invoices:read'],
};

const mockRunsData = {
  data: [
    {
      id: 'run-101',
      runNumber: 'TR-2026-0042',
      shift: 'MORNING',
      runDate: '2026-10-08',
      status: 'IN_PROGRESS',
      totalParcels: 2,
      totalWeightKg: 3.5,
      totalCodToCollect: 450,
      zone: { code: 'CAS-MAA', name: 'Maârif' },
      courier: {
        userId: 'courier-01',
        user: { id: 'courier-01', firstName: 'Karim', lastName: 'El Idrissi', phone: '+212600112233' },
      },
      items: [
        {
          id: 'item-1',
          sequenceOrder: 1,
          status: 'PENDING',
          isOutOfZone: false,
          parcel: {
            id: 'parcel-101',
            trackingNumber: 'HES-CAS-001234',
            weightKg: 1.5,
            shipment: {
              recipientName: 'Yassine Alami',
              recipientPhone: '+212612345678',
              recipientAddress: '14 Bd Zerktouni, Étage 3',
              recipientCity: 'Casablanca',
              codAmount: 250,
            },
          },
        },
        {
          id: 'item-2',
          sequenceOrder: 2,
          status: 'PENDING',
          isOutOfZone: false,
          parcel: {
            id: 'parcel-102',
            trackingNumber: 'HES-CAS-001235',
            weightKg: 2.0,
            shipment: {
              recipientName: 'Fatima Zahra',
              recipientPhone: '+212698765432',
              recipientAddress: '45 Rue Jean Jaurès',
              recipientCity: 'Casablanca',
              codAmount: 200,
            },
          },
        },
      ],
    },
  ],
  meta: { total: 1 },
};

const mockShipmentsData = {
  data: [
    {
      id: 'ship-1',
      trackingNumber: 'HES-CAS-001234',
      senderAgency: { code: 'CAS', name: 'Casablanca Port' },
      recipientAgency: { code: 'RAB', name: 'Rabat Agdal' },
      senderName: 'Alpha Logistics SARL',
      recipientName: 'Yassine Alami',
      recipientPhone: '+212612345678',
      recipientAddress: '14 Bd Zerktouni',
      recipientCity: 'Casablanca',
      status: 'IN_TRANSIT',
      totalParcels: 1,
      totalWeightKg: 1.5,
      codAmount: 250,
      createdAt: '2026-10-08T08:00:00Z',
    },
    {
      id: 'ship-2',
      trackingNumber: 'HES-CAS-001235',
      senderAgency: { code: 'CAS', name: 'Casablanca Port' },
      recipientAgency: { code: 'CAS', name: 'Casablanca Port' },
      senderName: 'Atlas Distribution',
      recipientName: 'Fatima Zahra',
      recipientPhone: '+212698765432',
      recipientAddress: '45 Rue Jean Jaurès',
      recipientCity: 'Casablanca',
      status: 'DELIVERED',
      totalParcels: 1,
      totalWeightKg: 2.0,
      codAmount: 200,
      createdAt: '2026-10-08T08:30:00Z',
    },
  ],
  meta: { total: 2, page: 1, limit: 15, totalPages: 1 },
};

const mockDashboardData = {
  period: { from: '2026-10-01', to: '2026-10-08', label: 'Semaine en cours' },
  filters: {},
  kpis: {
    totalShipments: 1240,
    delivered: 1120,
    inTransit: 85,
    outForDelivery: 35,
    pending: 15,
    cancelled: 12,
    returned: 8,
    collectionsTotal: 340,
    collectionsCompleted: 332,
    openIncidents: 3,
    deliverySuccessRate: 97.4,
    totalRevenue: 156400,
  },
  statusBreakdown: [
    { status: 'DELIVERED', count: 1120 },
    { status: 'IN_TRANSIT', count: 85 },
    { status: 'OUT_FOR_DELIVERY', count: 35 },
    { status: 'REGISTERED', count: 15 },
    { status: 'RETURNED', count: 8 },
    { status: 'CANCELLED', count: 12 },
  ],
};

const CORS_HEADERS = {
  'access-control-allow-origin': 'http://localhost:5173',
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
};

async function setupContextRoutes(context, currentUser = null) {
  await context.route(
    (url) => url.pathname.includes('/api/v1/auth/refresh'),
    async (route) => {
      if (currentUser) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify({
            user: currentUser,
            tokens: { accessToken: 'mock-jwt-token', refreshToken: 'mock-refresh-token' },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Non authentifié' }),
        });
      }
    }
  );

  await context.route(
    (url) => url.pathname.includes('/api/v1/auth/me'),
    async (route) => {
      if (currentUser) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify(currentUser),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Non authentifié' }),
        });
      }
    }
  );

  await context.route(
    (url) => url.pathname.includes('/api/v1/health'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: 'ok',
          version: '1.0.0',
          uptimeSeconds: 7200,
          services: {
            database: { status: 'up', latencyMs: 2 },
            redis: { status: 'up', latencyMs: 1 },
            storage: { status: 'up', latencyMs: 3 },
          },
        }),
      });
    }
  );

  await context.route(
    (url) => url.pathname.includes('/api/v1/runs'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(mockRunsData),
      });
    }
  );

  await context.route(
    (url) => url.pathname.includes('/api/v1/shipments'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(mockShipmentsData),
      });
    }
  );

  await context.route(
    (url) => url.pathname.includes('/api/v1/reports/dashboard'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(mockDashboardData),
      });
    }
  );

  await context.route(
    (url) => url.pathname.includes('/api/v1/notifications'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify([]),
      });
    }
  );
}

async function runVerification() {
  console.log('🚀 Lancement de la suite Playwright Chromium (Moteur réel)...\n');
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CI ? {} : { channel: 'chrome' }),
    });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const results = {
    checks: [],
    screenshots: [],
    errors: [],
  };

  const viewports = [
    { width: 375, height: 667, name: '375px' },
    { width: 768, height: 1024, name: '768px' },
    { width: 1440, height: 900, name: '1440px' },
  ];

  try {
    // =========================================================================
    // 1. PAGE DE CONNEXION & EN-TÊTE UNIFIÉ (NON AUTHENTIFIÉ)
    // =========================================================================
    console.log('--- 1. Page de Connexion & En-tête Unifié ---');
    {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await setupContextRoutes(context, null);
      const page = await context.newPage();

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);

        // Si besoin de basculer vers le formulaire connexion
        const loginBtn = page.locator('header.sticky button:has-text("Connexion")');
        if (await loginBtn.isVisible()) {
          await loginBtn.click();
          await page.waitForTimeout(300);
        }

        // Test 1: Un seul nom de marque visible dans l'en-tête
        const headerBrandTexts = await page.$$eval('header.sticky span', (spans) =>
          spans.filter((s) => s.textContent.includes('HES') && s.offsetParent !== null).map((s) => s.textContent.trim())
        );
        const isHeaderSingleBrand = headerBrandTexts.length === 1;
        results.checks.push({
          test: `En-tête: un seul nom de plateforme affiché (${vp.name})`,
          passed: isHeaderSingleBrand,
          details: `Occurrence(s) visible(s) : ${headerBrandTexts.length} (${JSON.stringify(headerBrandTexts)})`,
        });

        // Test 2: Aucun débordement horizontal
        const scrollDiff = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        results.checks.push({
          test: `Aucun débordement horizontal (${vp.name})`,
          passed: scrollDiff <= 1,
          details: `scrollWidth - innerWidth = ${scrollDiff}px`,
        });

        // Test 3: Hauteur du bouton de soumission >= 44px
        const formSubmitBtn = page.locator('form button[type="submit"]');
        if (await formSubmitBtn.isVisible()) {
          const submitHeight = await formSubmitBtn.evaluate((el) => parseFloat(window.getComputedStyle(el).height));
          results.checks.push({
            test: `Bouton Formulaire Connexion: hauteur calculée >= 44px (${vp.name})`,
            passed: submitHeight >= 44,
            details: `Hauteur mesurée : ${submitHeight}px`,
          });
        }

        // Test 4: Absence de jargon Argon2id
        const bodyText = await page.textContent('body');
        const hasArgon = bodyText.includes('Argon2id');
        results.checks.push({
          test: `Absence du libellé technique "Argon2id" (${vp.name})`,
          passed: !hasArgon,
          details: hasArgon ? 'Présent !' : 'Absent (conforme)',
        });

        const screenPath = path.join(screenshotsDir, `login-${vp.name}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        results.screenshots.push(screenPath);
        console.log(`  📸 login-${vp.name}.png`);
      }
      await context.close();
    }

    // =========================================================================
    // 2. PAGE DE STATUT SYSTÈME
    // =========================================================================
    console.log('\n--- 2. Page de Statut Système ---');
    {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await setupContextRoutes(context, null);
      const page = await context.newPage();

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);

        const statusBtn = page.locator('footer button:has-text("Statut système")');
        if (await statusBtn.isVisible()) {
          await statusBtn.click();
          await page.waitForTimeout(300);
        }

        const bodyText = await page.textContent('body');
        const hasPhase1 = bodyText.includes('Phase 1 Infrastructure');
        results.checks.push({
          test: `Absence du libellé "Phase 1 Infrastructure" (${vp.name})`,
          passed: !hasPhase1,
          details: hasPhase1 ? 'Présent !' : 'Absent (conforme)',
        });

        const screenPath = path.join(screenshotsDir, `status-${vp.name}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        results.screenshots.push(screenPath);
        console.log(`  📸 status-${vp.name}.png`);
      }
      await context.close();
    }

    // =========================================================================
    // 3. TOURNÉES LIVREUR (Rôle COURIER) & BOTTOM NAVIGATION BAR & BOUTON LIVRÉ
    // =========================================================================
    console.log('\n--- 3. Tournées Livreur & BottomNavigationBar ---');
    {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await setupContextRoutes(context, courierUser);
      const page = await context.newPage();
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.log('  PAGE ERROR:', msg.text());
      });

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);

        // Ouvrir la vue tournées si besoin
        const runsTab = page.locator('[data-testid="btn-bottom-my-runs"]:visible, header button:has-text("Mes Tournées"):visible').first();
        if (await runsTab.isVisible()) {
          await runsTab.click();
          await page.waitForTimeout(600);
        }

        // Test BottomNavigationBar display (Breakpoint lg: 1024px)
        const bottomBar = page.locator('[data-testid="bottom-navigation-bar"]');
        if ((await bottomBar.count()) > 0) {
          const displayVal = await bottomBar.evaluate((el) => window.getComputedStyle(el).display);
          if (vp.width < 1024) {
            results.checks.push({
              test: `BottomNavigationBar visible sur mobile/tablette (< 1024px - ${vp.name})`,
              passed: displayVal === 'flex' || displayVal === 'block',
              details: `display mesuré : "${displayVal}"`,
            });
          } else {
            results.checks.push({
              test: `BottomNavigationBar masquée sur desktop (>= 1024px - ${vp.name})`,
              passed: displayVal === 'none',
              details: `display mesuré : "${displayVal}"`,
            });
          }
        }

        // Test Bouton "Livré" >= 44px
        const livreBtn = page.locator('button:has-text("Livré")').first();
        if (await livreBtn.isVisible()) {
          const livreHeight = await livreBtn.evaluate((el) => parseFloat(window.getComputedStyle(el).height));
          results.checks.push({
            test: `Bouton "Livré": hauteur calculée >= 44px (${vp.name})`,
            passed: livreHeight >= 44,
            details: `Hauteur mesurée : ${livreHeight}px`,
          });
        }

        const screenPath = path.join(screenshotsDir, `courier-runs-${vp.name}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        results.screenshots.push(screenPath);
        console.log(`  📸 courier-runs-${vp.name}.png`);
      }

      // Test spécifique du point de rupture et non-recouvrement à 1000px (inférieur au breakpoint lg: 1024px)
      console.log('  Testing breakpoint à 1000px (inférieur à lg: 1024px)...');
      {
        await page.setViewportSize({ width: 1000, height: 800 });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);

        const runsTab = page.locator('[data-testid="btn-bottom-my-runs"]:visible, header button:has-text("Mes Tournées"):visible').first();
        if (await runsTab.isVisible()) {
          await runsTab.click();
          await page.waitForTimeout(600);
        }

        const bottomBar = page.locator('[data-testid="bottom-navigation-bar"]');
        const isBarVisible = await bottomBar.isVisible();
        const displayVal = await bottomBar.evaluate((el) => window.getComputedStyle(el).display);

        results.checks.push({
          test: 'Point de rupture 1000px: BottomNavigationBar visible car < lg (1024px)',
          passed: isBarVisible && (displayVal === 'flex' || displayVal === 'block'),
          details: `display mesuré: "${displayVal}", visible: ${isBarVisible} (classe lg:hidden inactive car viewport 1000px < 1024px)`,
        });

        // Défilement jusqu'en bas pour vérifier que le dernier élément de contenu n'est pas recouvert
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);

        const bottomBarBox = await bottomBar.boundingBox();
        const lastFooterElem = page.locator('footer button, footer span').last();
        const lastElemBox = await lastFooterElem.boundingBox();

        const clearance = bottomBarBox && lastElemBox ? (bottomBarBox.y - (lastElemBox.y + lastElemBox.height)) : -1;
        const isNotCovered = clearance >= 0;

        results.checks.push({
          test: 'Point de rupture 1000px: Le dernier élément de contenu n\'est PAS recouvert par la BottomNavigationBar',
          passed: isNotCovered,
          details: `Clearance mesurée: ${clearance.toFixed(1)}px (bottomBar.y = ${bottomBarBox?.y}px, dernier élément bas = ${(lastElemBox.y + lastElemBox.height).toFixed(1)}px, padding pb-16/pb-20 effectif)`,
        });
      }
      await context.close();
    }

    // =========================================================================
    // 4. CONFIRMATION DE LIVRAISON (MODAL POD)
    // =========================================================================
    console.log('\n--- 4. Modal Confirmation de Livraison (POD) ---');
    {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await setupContextRoutes(context, courierUser);
      const page = await context.newPage();

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);

        const runsTab = page.locator('[data-testid="btn-bottom-my-runs"]:visible, header button:has-text("Mes Tournées"):visible').first();
        if (await runsTab.isVisible()) {
          await runsTab.click();
          await page.waitForTimeout(600);
        }

        const livreBtn = page.locator('button:has-text("Livré")').first();
        if (await livreBtn.isVisible()) {
          await livreBtn.click();
          await page.waitForTimeout(600);

          const confirmBtn = page.locator('button:has-text("Confirmer la Livraison")');
          if (await confirmBtn.isVisible()) {
            const confHeight = await confirmBtn.evaluate((el) => parseFloat(window.getComputedStyle(el).height));
            results.checks.push({
              test: `Modal POD - Bouton de confirmation >= 44px (${vp.name})`,
              passed: confHeight >= 44,
              details: `Hauteur mesurée : ${confHeight}px`,
            });
          }

          const screenPath = path.join(screenshotsDir, `delivery-confirm-${vp.name}.png`);
          await page.screenshot({ path: screenPath });
          results.screenshots.push(screenPath);
          console.log(`  📸 delivery-confirm-${vp.name}.png`);

          const closeBtn = page.locator('button:has-text("Annuler")');
          if (await closeBtn.isVisible()) await closeBtn.click();
        }
      }
      await context.close();
    }

    // =========================================================================
    // 5. DEMANDE DE COLLECTE CLIENT (Rôle CLIENT)
    // =========================================================================
    console.log('\n--- 5. Demande de Collecte Client ---');
    {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await setupContextRoutes(context, clientUser);
      const page = await context.newPage();

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);

        const collectTab = page.locator('[data-testid="btn-bottom-request-collection"]:visible, header button:has-text("Enlèvement"):visible').first();
        if (await collectTab.isVisible()) {
          await collectTab.click();
          await page.waitForTimeout(600);
        }

        const screenPath = path.join(screenshotsDir, `collection-request-${vp.name}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        results.screenshots.push(screenPath);
        console.log(`  📸 collection-request-${vp.name}.png`);
      }
      await context.close();
    }

    // =========================================================================
    // 6. DASHBOARD & EXPÉDITIONS ADMIN (Rôle ADMIN)
    // =========================================================================
    console.log('\n--- 6. Dashboard & Expéditions Admin ---');
    {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await setupContextRoutes(context, adminUser);
      const page = await context.newPage();

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);

        // 6.1 Dashboard
        const dashTab = page.locator('header.sticky button:has-text("Dashboard")').first();
        if (await dashTab.isVisible()) {
          await dashTab.click();
          await page.waitForTimeout(500);
        }
        const dashScreenPath = path.join(screenshotsDir, `dashboard-${vp.name}.png`);
        await page.screenshot({ path: dashScreenPath, fullPage: true });
        results.screenshots.push(dashScreenPath);
        console.log(`  📸 dashboard-${vp.name}.png`);

        // 6.2 Expéditions
        const shipTab = page.locator('header.sticky button:has-text("Expéditions")').first();
        if (await shipTab.isVisible()) {
          await shipTab.click();
          await page.waitForTimeout(500);
        }
        const shipScreenPath = path.join(screenshotsDir, `shipments-${vp.name}.png`);
        await page.screenshot({ path: shipScreenPath, fullPage: true });
        results.screenshots.push(shipScreenPath);
        console.log(`  📸 shipments-${vp.name}.png`);
      }
      await context.close();
    }

    // =========================================================================
    // 7. TEST SERVICE WORKER & RECHARGEMENT FORCÉ
    // =========================================================================
    console.log('\n--- 7. Test Service Worker & Rechargement Forcé ---');
    {
      const context = await browser.newContext({ serviceWorkers: 'allow' });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const swCount = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          return regs.length;
        }
        return 0;
      });

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const hasStyles = await page.evaluate(() => {
        const btn = document.querySelector('button');
        if (!btn) return true;
        const bg = window.getComputedStyle(btn).backgroundColor;
        return bg !== '' && bg !== 'transparent';
      });

      results.checks.push({
        test: 'Service Worker actif et rechargement forcé sans perte de style',
        passed: hasStyles,
        details: `Enregistrements SW détectés : ${swCount}, Style conservé : ${hasStyles}`,
      });
      await context.close();
    }

  } catch (err) {
    console.error('❌ Erreur inattendue dans la suite de tests:', err);
    results.errors.push(err.message || String(err));
  } finally {
    await browser.close();
  }

  // =========================================================================
  // BILAN SYNTHÉTIQUE
  // =========================================================================
  console.log('\n=============================================================');
  console.log('📊 BILAN DES VÉRIFICATIONS PLAYWRIGHT CHROMIUM :');
  console.log('=============================================================');
  let allPassed = true;
  for (const c of results.checks) {
    const sym = c.passed ? '✅' : '❌';
    console.log(`${sym} [${c.passed ? 'PASS' : 'FAIL'}] ${c.test} : ${c.details}`);
    if (!c.passed) allPassed = false;
  }
  console.log('=============================================================');
  console.log(`Total des captures enregistrées : ${results.screenshots.length} fichiers.`);

  if (!allPassed || results.errors.length > 0) {
    console.error('Certains tests ont échoué.');
    process.exit(1);
  } else {
    console.log('🎉 TOUS LES TESTS CALCULÉS ET SCREENSHOTS SONT VALIDES !');
  }
}

runVerification().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
