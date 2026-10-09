import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], channel: 'chrome' },
    },
    {
      name: 'Tablet Chrome',
      use: { viewport: { width: 768, height: 1024 }, ...(process.env.CI ? {} : { channel: 'chrome' }) },
    },
    {
      name: 'Desktop Chrome',
      use: { viewport: { width: 1440, height: 900 }, channel: 'chrome' },
    },
  ],
});
