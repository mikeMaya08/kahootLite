import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }],
    ['@muuktest/amikoo-reporter']
  ],
  use: {
    video: 'on',
    launchOptions: { slowMo: process.env.SLOW_MO ? Number(process.env.SLOW_MO) : 0 },
    baseURL: 'https://kahootlite.vercel.app',
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
