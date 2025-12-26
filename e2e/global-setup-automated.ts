import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

/**
 * Automated Global Setup for Playwright tests
 * Uses test-login API endpoint for automatic authentication
 * No manual interaction required!
 *
 * Prerequisites:
 *   1. Test user must exist in database (run: npm run db:seed-test-user)
 *   2. Dev server must be running (npm run dev)
 *   3. NODE_ENV must NOT be 'production'
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const authFile = path.join(__dirname, '.auth', 'user.json');
  const testUserEmail = 'e2e-test@example.com';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n🤖 Automated authentication setup...');
    console.log(`   Base URL: ${baseURL || 'http://localhost:3000'}`);
    console.log(`   Test user: ${testUserEmail}\n`);

    // Navigate to the app
    await page.goto(baseURL || 'http://localhost:3000');

    // Check if test login endpoint is available
    const checkResponse = await page.request.get('/api/auth/test-login');
    const checkData = await checkResponse.json();

    if (!checkData.available) {
      throw new Error(
        `Test login not available: ${checkData.message}\n` +
        `Make sure NODE_ENV is not 'production'`
      );
    }

    console.log('   ✅ Test login endpoint available');

    // Authenticate using test endpoint
    const loginResponse = await page.request.post('/api/auth/test-login', {
      data: { email: testUserEmail },
    });

    if (!loginResponse.ok()) {
      const errorData = await loginResponse.json();
      throw new Error(
        `Test login failed: ${errorData.error}\n` +
        `Did you run 'npm run db:seed-test-user'?`
      );
    }

    const loginData = await loginResponse.json();
    console.log('   ✅ Authenticated as:', loginData.user.username);

    // Reload page to apply session
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify authentication worked
    const isAuthenticated = await page.getByTestId('app-container').isVisible({ timeout: 5000 }).catch(() => false);

    if (!isAuthenticated) {
      throw new Error('Authentication succeeded but dashboard not visible');
    }

    console.log('   ✅ Dashboard loaded successfully');

    // Save authenticated state
    await context.storageState({ path: authFile });
    console.log(`   💾 Auth state saved to ${authFile}`);
    console.log('   🎉 Automated authentication complete!\n');

  } catch (error) {
    console.error('\n❌ Automated authentication failed:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Run: npm run db:seed-test-user');
    console.error('  2. Ensure dev server is running: npm run dev');
    console.error('  3. Check NODE_ENV is not "production"\n');
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
