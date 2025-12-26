import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

/**
 * Global setup for Playwright tests
 * Authenticates once and saves session state for reuse
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const authFile = path.join(__dirname, '.auth', 'user.json');

  // Launch browser
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔐 Setting up authentication...');

    await page.goto(baseURL || 'http://localhost:3000');

    // Wait for login page
    await page.waitForLoadState('networkidle');

    // Check if already authenticated (rare, but possible)
    const isAuthenticated = await page.getByTestId('app-container').isVisible({ timeout: 2000 }).catch(() => false);

    if (!isAuthenticated) {
      console.log('⏳ Please authenticate in the browser window...');
      console.log('   1. Click "Sign in with Touch ID" or "Continue with email"');
      console.log('   2. Complete the authentication flow');
      console.log('   3. Tests will continue automatically once authenticated');

      // Wait for authentication to complete (user sees dashboard)
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 120000 }); // 2 minutes

      console.log('✅ Authentication successful!');
    } else {
      console.log('✅ Already authenticated');
    }

    // Save authenticated state
    await context.storageState({ path: authFile });
    console.log(`💾 Auth state saved to ${authFile}`);

  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
