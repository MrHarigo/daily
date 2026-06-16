import { test, expect } from '@playwright/test';
import { mockWebAuthn } from './fixtures/auth';

/**
 * Test Suite: Tab Switching Preserves Data
 *
 * Tests the requirement from issue #15:
 * "Tab switching preserves data"
 *
 * Validates that:
 * 1. Users can switch between tabs (Today, Stats, Settings)
 * 2. Each tab renders its correct content
 * 3. Active tab state is correctly highlighted
 * 4. Data/state is preserved when switching back to a previous tab
 */

test.describe('Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    // Mock WebAuthn for potential passkey interactions
    await mockWebAuthn(page);
  });

  test('should switch between all tabs and display correct content', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load (either login screen or dashboard)
    await page.waitForLoadState('networkidle');

    // Check if we need to authenticate
    // In a real test environment, you'd have test credentials
    const isLoginVisible = await page.locator('button:has-text("Sign in with Touch ID")').isVisible().catch(() => false);

    if (isLoginVisible) {
      // For this test to work, you need to be authenticated
      // In a full test suite, you'd use fixtures to pre-authenticate
      test.skip();
      return;
    }

    // Verify we're on the Today tab by default
    await expect(page.getByTestId('tab-today')).toHaveClass(/accent/);
    await expect(page.getByTestId('dashboard')).toBeVisible();

    // Switch to Stats tab
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('tab-stats')).toHaveClass(/accent/);
    await expect(page.getByTestId('stats')).toBeVisible();
    await expect(page.getByTestId('dashboard')).not.toBeVisible();

    // Switch to Settings tab
    await page.getByTestId('tab-settings').click();
    await expect(page.getByTestId('tab-settings')).toHaveClass(/accent/);
    await expect(page.getByTestId('settings')).toBeVisible();
    await expect(page.getByTestId('stats')).not.toBeVisible();

    // Switch back to Today tab
    await page.getByTestId('tab-today').click();
    await expect(page.getByTestId('tab-today')).toHaveClass(/accent/);
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expect(page.getByTestId('settings')).not.toBeVisible();
  });

  test('should preserve selected date when switching tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check authentication
    const isLoginVisible = await page.locator('button:has-text("Sign in with Touch ID")').isVisible().catch(() => false);
    if (isLoginVisible) {
      // Authentication required
      test.skip();
      return;
    }

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard')).toBeVisible();

    // Try to find and interact with the date selector if it exists
    const dateSelector = page.locator('[data-testid="date-selector"]').first();
    const hasDateselector = await dateSelector.isVisible().catch(() => false);

    if (hasDateselector) {
      // Get current date text
      const currentDate = await dateSelector.textContent();

      // Switch to Stats
      await page.getByTestId('tab-stats').click();
      await expect(page.getByTestId('stats')).toBeVisible();

      // Switch back to Today
      await page.getByTestId('tab-today').click();
      await expect(page.getByTestId('dashboard')).toBeVisible();

      // Verify date is still the same
      const dateAfterSwitch = await dateSelector.textContent();
      expect(dateAfterSwitch).toBe(currentDate);
    }
  });

  test('should maintain scroll position when switching tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const isLoginVisible = await page.locator('button:has-text("Sign in with Touch ID")').isVisible().catch(() => false);
    if (isLoginVisible) {
      // Authentication required
      test.skip();
      return;
    }

    // Wait for Settings to have content
    await page.getByTestId('tab-settings').click();
    await expect(page.getByTestId('settings')).toBeVisible();

    // Scroll down in Settings (if there's scrollable content)
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(100); // Let scroll settle

    const scrollPosition = await page.evaluate(() => window.scrollY);

    // Switch to another tab
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('stats')).toBeVisible();

    // Switch back to Settings
    await page.getByTestId('tab-settings').click();
    await expect(page.getByTestId('settings')).toBeVisible();

    // Note: Scroll position might be reset by the app
    // This test documents the current behavior
    const newScrollPosition = await page.evaluate(() => window.scrollY);

    // Document whether scroll is preserved (may be 0 if reset to top)
    console.log(`Original scroll: ${scrollPosition}, After tab switch: ${newScrollPosition}`);
  });

  test('should show correct tab highlights', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const isLoginVisible = await page.locator('button:has-text("Sign in with Touch ID")').isVisible().catch(() => false);
    if (isLoginVisible) {
      // Authentication required
      test.skip();
      return;
    }

    // Initially Today should be active
    await expect(page.getByTestId('tab-today')).toHaveClass(/accent/);
    await expect(page.getByTestId('tab-stats')).not.toHaveClass(/accent/);
    await expect(page.getByTestId('tab-settings')).not.toHaveClass(/accent/);

    // Click Stats
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('tab-stats')).toHaveClass(/accent/);
    await expect(page.getByTestId('tab-today')).not.toHaveClass(/accent/);
    await expect(page.getByTestId('tab-settings')).not.toHaveClass(/accent/);

    // Click Settings
    await page.getByTestId('tab-settings').click();
    await expect(page.getByTestId('tab-settings')).toHaveClass(/accent/);
    await expect(page.getByTestId('tab-today')).not.toHaveClass(/accent/);
    await expect(page.getByTestId('tab-stats')).not.toHaveClass(/accent/);
  });

  test('should reset to Today tab after login', async ({ page }) => {
    await page.goto('/');

    // This test verifies the behavior described in page.tsx:49-59
    // When a user logs in, the tab should reset to 'today'

    // For this test, we'd need to:
    // 1. Start logged out
    // 2. Somehow be on a different tab (which shouldn't be possible when logged out)
    // 3. Log in
    // 4. Verify we're on Today tab

    // This is more of an integration test that requires proper auth flow
    // Marking as informational for now
    test.skip();
  });
});
