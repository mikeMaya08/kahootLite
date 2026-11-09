import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['@muuktest/amikoo-reporter']
  ],
  use: {
    video: 'on',
    launchOptions: { slowMo: process.env.SLOW_MO ? Number(process.env.SLOW_MO) : 0 },
    // Target deployment; override with BASE_URL to run against preview/staging.
    baseURL: process.env.BASE_URL || 'https://kahootlite.vercel.app',
    // Applied to every test (not only those calling setBypassHeader) so Vercel
    // Deployment Protection never blocks a spec. No-op when the secret is unset.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          'x-vercel-set-bypass-cookie': 'samesitenone',
        }
      : undefined,
    trace: 'on-first-retry',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
