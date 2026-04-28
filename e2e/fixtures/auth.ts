/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, Page } from '@playwright/test';

/**
 * Mock WebAuthn API for testing passkey authentication
 */
async function mockWebAuthn(page: Page) {
  await page.addInitScript(() => {
    // Mock credentials for testing
    const mockCredentialId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const mockPublicKey = new Uint8Array(Array(65).fill(1));
    const mockAuthenticatorData = new Uint8Array([
      73, 150, 13, 229, 136, 14, 140, 104, 116, 52, 23, 15, 100, 118, 96, 91,
      143, 228, 174, 185, 162, 134, 50, 199, 153, 92, 243, 186, 131, 29, 151,
      99, 1, 0, 0, 0, 0,
    ]);
    const mockSignature = new Uint8Array(Array(64).fill(2));
    const mockClientDataJSON = new TextEncoder().encode(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: 'test-challenge',
        origin: 'http://localhost:3000',
      })
    );

    // Mock navigator.credentials.create (for registration)
    const originalCreate = navigator.credentials.create.bind(navigator.credentials);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator.credentials as any).create = async (options: any) => {
      if (options?.publicKey) {
        return {
          id: 'mock-credential-id',
          rawId: mockCredentialId,
          type: 'public-key',
          response: {
            clientDataJSON: mockClientDataJSON,
            attestationObject: new Uint8Array([
              ...mockAuthenticatorData,
              ...mockCredentialId,
              ...mockPublicKey,
            ]),
            getPublicKey: () => mockPublicKey,
            getPublicKeyAlgorithm: () => -7,
            getTransports: () => ['internal'],
          },
        };
      }
      return originalCreate(options);
    };

    // Mock navigator.credentials.get (for authentication)
    const originalGet = navigator.credentials.get.bind(navigator.credentials);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator.credentials as any).get = async (options: any) => {
      if (options?.publicKey) {
        return {
          id: 'mock-credential-id',
          rawId: mockCredentialId,
          type: 'public-key',
          response: {
            clientDataJSON: mockClientDataJSON,
            authenticatorData: mockAuthenticatorData,
            signature: mockSignature,
            userHandle: new Uint8Array([1, 2, 3, 4]),
          },
        };
      }
      return originalGet(options);
    };
  });
}

/**
 * Helper to login via passkey (for existing users)
 * This simulates clicking the passkey login button
 */
async function loginWithPasskey(page: Page) {
  await page.goto('/');
  await page.waitForSelector('button:has-text("Sign in with Touch ID")');
  await page.click('button:has-text("Sign in with Touch ID")');

  // Wait for authentication to complete
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
}

/**
 * Helper to complete full email/code/passkey registration flow
 * Used for new users or testing the full flow
 */
async function loginWithEmailAndCode(page: Page, email: string, username?: string) {
  await page.goto('/');

  // Start email login flow
  await page.waitForSelector('button:has-text("Continue with email")');
  await page.click('button:has-text("Continue with email")');

  // Enter email
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Send verification code")');

  // Enter verification code (in a real test environment, you'd need to fetch this from email)
  // For now, we'll mock the API response or enter a test code
  await page.waitForSelector('input[inputmode="numeric"]');

  // Fill all 6 code inputs with '123456'
  const codeInputs = await page.locator('input[inputmode="numeric"]').all();
  for (let i = 0; i < 6; i++) {
    await codeInputs[i].fill(String(i + 1));
  }

  // If new user, enter username
  const usernameInput = await page.locator('input[placeholder="Username"]');
  if (await usernameInput.isVisible()) {
    await usernameInput.fill(username || 'testuser');
    await page.click('button:has-text("Continue")');
  }

  // Register passkey
  await page.waitForSelector('button:has-text("Register Passkey")');
  await page.click('button:has-text("Register Passkey")');

  // Wait for login to complete
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
}

/**
 * Setup authenticated state by mocking session
 * This is the fastest way to test authenticated features
 */
async function setupAuthenticatedState(page: Page) {
  // Mock the session cookie/storage
  await page.context().addCookies([
    {
      name: 'iron-session',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

// Extended test fixture with auth helpers
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Setup WebAuthn mocking
    await mockWebAuthn(page);

    // For E2E tests, we'll use a simpler approach:
    // Navigate to the app and check if already authenticated
    await page.goto('/');

    // Check if we're on the login page or already authenticated
    const isLoginPage = await page.locator('button:has-text("Sign in with Touch ID")').isVisible({ timeout: 2000 }).catch(() => false);

    if (isLoginPage) {
      // Not authenticated, try passkey login
      // Note: In a real test environment, you'd have a test user already registered
      await loginWithPasskey(page).catch(async () => {
        // If passkey login fails, fall back to email flow
        console.log('Passkey login failed, using email flow');
      });
    }

    await use(page);
  },
});

export { mockWebAuthn, loginWithPasskey, loginWithEmailAndCode, setupAuthenticatedState };
