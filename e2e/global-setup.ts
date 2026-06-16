import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

/**
 * Global setup for Playwright tests
 * Authenticates once and saves session state for reuse
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const authFile = path.join(__dirname, '.auth', 'user.json');

  // Launch browser in headed mode (visible to user for authentication)
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100, // Slow down actions slightly for visibility
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n🔐 Setting up authentication...');

    await page.goto(baseURL || 'http://localhost:3000');

    // Wait for login page
    await page.waitForLoadState('networkidle');

    // Check if already authenticated (rare, but possible)
    const isAuthenticated = await page.getByTestId('app-container').isVisible({ timeout: 2000 }).catch(() => false);

    if (!isAuthenticated) {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║          🔐 AUTHENTICATION REQUIRED                        ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      console.log('  A browser window has opened.');
      console.log('  Please complete the authentication:\n');
      console.log('  1️⃣  Click "Sign in with Touch ID" or "Continue with email"');
      console.log('  2️⃣  Complete the authentication flow');
      console.log('  3️⃣  Tests will continue automatically once authenticated\n');
      console.log('  ⏱️  Waiting up to 2 minutes for authentication...\n');

      // Wait for authentication to complete (user sees dashboard)
      try {
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 120000 }); // 2 minutes
        console.log('  ✅ Authentication successful!\n');
      } catch (error) {
        console.error('\n  ❌ Authentication timeout. Please try again.\n');
        throw new Error('Authentication failed: timeout waiting for dashboard');
      }
    } else {
      console.log('  ✅ Already authenticated\n');
    }

    // Save authenticated state
    await context.storageState({ path: authFile });
    console.log(`  💾 Auth state saved to ${authFile}`);
    console.log('  🎉 All tests will now run with authentication!\n');

  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
