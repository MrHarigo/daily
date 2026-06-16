import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // Global setup for authentication
  // Use automated setup if E2E_AUTOMATED=1, otherwise manual setup
  globalSetup: process.env.E2E_AUTHENTICATED
    ? (process.env.E2E_AUTOMATED ? './e2e/global-setup-automated.ts' : './e2e/global-setup.ts')
    : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Use saved auth state if authenticated mode is enabled
    storageState: process.env.E2E_AUTHENTICATED ? path.join(__dirname, 'e2e', '.auth', 'user.json') : undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
