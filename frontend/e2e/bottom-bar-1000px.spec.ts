import { test, expect } from '@playwright/test';

test.describe('BottomNavigationBar & Breakpoints Responsive (1000px)', () => {
  test('vérifie la visibilité à 1000px et l\'absence de recouvrement du dernier élément de contenu', async ({
    page,
    context,
  }) => {
    // Configuration d'un utilisateur courier mocké
    const courierUser = {
      id: 'courier-01',
      email: 'livreur@hes.ma',
      firstName: 'Karim',
      lastName: 'El Idrissi',
      role: 'COURIER',
      isActive: true,
      permissions: ['runs:read', 'deliveries:create'],
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
          items: [],
        },
      ],
      meta: { total: 1 },
    };

    await context.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: courierUser, tokens: { accessToken: 'token', refreshToken: 'refresh' } }),
      });
    });

    await context.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(courierUser),
      });
    });

    await context.route('**/api/v1/runs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRunsData),
      });
    });

    await context.route('**/api/v1/notifications**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    // 1. Définir le viewport exact à 1000px
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Ouvrir la vue tournées si besoin
    const runsTab = page.locator('[data-testid="btn-bottom-my-runs"]:visible, header button:has-text("Mes Tournées"):visible').first();
    if (await runsTab.isVisible()) {
      await runsTab.click();
    }

    // 2. Vérifier que la BottomNavigationBar est visible à 1000px car 1000px < 1024px (breakpoint lg)
    const bottomBar = page.locator('[data-testid="bottom-navigation-bar"]');
    await expect(bottomBar).toBeVisible();

    const display = await bottomBar.evaluate((el) => window.getComputedStyle(el).display);
    expect(display).toBe('flex');

    // 3. Défiler tout en bas
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);

    // 4. Récupérer les bounding boxes
    const bottomBarBox = await bottomBar.boundingBox();
    expect(bottomBarBox).not.toBeNull();

    const lastFooterElem = page.locator('footer button, footer span').last();
    const lastElemBox = await lastFooterElem.boundingBox();
    expect(lastElemBox).not.toBeNull();

    if (bottomBarBox && lastElemBox) {
      // Le bas du dernier élément doit être situé au-dessus ou au niveau du haut de la barre
      const lastElemBottom = lastElemBox.y + lastElemBox.height;
      expect(lastElemBottom).toBeLessThanOrEqual(bottomBarBox.y);
    }
  });
});
