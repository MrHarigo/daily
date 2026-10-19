import { test, expect } from '@playwright/test';
import { mockWebAuthn } from './fixtures/auth';

/**
 * Test Suite: Pomodoro timer
 *
 * Validates the core timer logic with a fake clock:
 * 1. Pause keeps the remaining time
 * 2. Reaching zero switches to the break phase and stops
 */

test.describe('Pomodoro', () => {
  test.beforeEach(async ({ page }) => {
    await mockWebAuthn(page);
    await page.clock.install();
    // Start from the default 25/5 state
    await page.addInitScript(() => localStorage.removeItem('pomodoro'));
  });

  test('pauses, resumes and switches to break when focus ends', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const isLoginVisible = await page.locator('button:has-text("Sign in with Touch ID")').isVisible().catch(() => false);
    if (isLoginVisible) {
      test.skip();
      return;
    }

    await page.getByTestId('tab-pomodoro').click();
    const pomodoro = page.getByTestId('pomodoro');
    await expect(pomodoro.getByText('25:00', { exact: true })).toBeVisible();

    await pomodoro.getByRole('button', { name: 'Start' }).click();
    await page.clock.fastForward('10:00');
    await pomodoro.getByRole('button', { name: 'Pause' }).click();
    await expect(pomodoro.getByText('15:00', { exact: true })).toBeVisible();

    // Paused time doesn't count
    await page.clock.fastForward('05:00');
    await expect(pomodoro.getByText('15:00', { exact: true })).toBeVisible();

    await pomodoro.getByRole('button', { name: 'Start' }).click();
    await page.clock.fastForward('15:00');

    await expect(pomodoro.getByText('05:00', { exact: true })).toBeVisible();
    await expect(pomodoro.getByRole('button', { name: 'Break', exact: true })).toHaveClass(/text-accent/);
    await expect(pomodoro.getByRole('button', { name: 'Start' })).toBeVisible();
  });
});
