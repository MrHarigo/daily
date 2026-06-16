# E2E Tests for Daily Habit Tracker

This directory contains end-to-end tests using Playwright to validate critical user workflows and ensure the application behaves correctly under various conditions.

## Test Suites

### 1. Tab Switching (`tab-switching.spec.ts`)

Tests the requirement: **"Tab switching preserves data"**

Validates:
- Users can switch between tabs (Today, Stats, Settings)
- Each tab renders its correct content
- Active tab state is correctly highlighted
- Data/state is preserved when switching back to a previous tab
- Selected date persists across tab switches

**Reference**: `app/page.tsx:23-47, 127-161`

### 2. Auto-Refresh After Idle (`idle-refresh.spec.ts`)

Tests the requirement: **"Auto-refresh after idle"**

Validates:
- Page hidden for >30 seconds triggers refetch when made visible
- Page hidden for <30 seconds does NOT trigger refetch
- Different tabs refetch appropriate data (habits, stats, devices)
- Past date auto-switches to today on visibility
- Rapid visibility changes are handled gracefully

**Reference**: `app/page.tsx:62-101` (uses Page Visibility API with 30-second threshold)

### 3. Error Recovery Flows (`error-recovery.spec.ts`)

Tests the requirement: **"Error recovery flows"**

Validates:
- Session expiration (401) logs out user with appropriate message
- Error boundaries catch render errors and allow retry
- Network errors are handled gracefully
- API operation errors don't crash the app
- Device registration conflicts are handled
- Malformed API responses don't crash the app
- Concurrent errors are handled properly

**References**:
- Session expiration: `lib/api.ts:15-22`, `app/page.tsx:32-42`
- Error boundaries: `components/ErrorBoundary.tsx`
- Login errors: `components/Login.tsx`

## Running Tests

### Prerequisites

```bash
# Install dependencies (including Playwright)
npm install

# Install browser binaries (if not already done)
npx playwright install
```

### Run all E2E tests

```bash
npm run test:e2e
```

### Run tests in UI mode (interactive debugging)

```bash
npm run test:e2e:ui
```

### Run tests in debug mode

```bash
npm run test:e2e:debug
```

### Run specific test file

```bash
npx playwright test e2e/tab-switching.spec.ts
```

### Run specific test

```bash
npx playwright test -g "should switch between all tabs"
```

## Current Limitations

### Authentication Required

⚠️ **Most tests currently require manual authentication setup**

The tests are designed to work with an authenticated user, but the test infrastructure doesn't yet have automated authentication. This means:

1. Tests will skip if not authenticated
2. To run tests fully, you need to:
   - Have a test user account
   - Manually log in once to establish session
   - OR set up test fixtures with pre-authenticated state

### Recommended Setup (Future Enhancement)

For full test automation, consider:

1. **Test Database**: Use a separate test database with seed data
2. **Test User**: Create dedicated test credentials
3. **Auth Fixture**: Implement authentication fixture that:
   - Sets up mock session cookies
   - OR uses a test passkey
   - OR bypasses auth in test mode

Example approach:

```typescript
// In playwright.config.ts
use: {
  storageState: 'e2e/fixtures/.auth/user.json', // Saved auth state
}
```

```bash
# Setup script to generate auth state
npx playwright codegen --save-storage=e2e/fixtures/.auth/user.json http://localhost:3000
```

## Test Data Requirements

Some tests expect certain data to exist:

- **Habits**: At least one habit for testing habit operations
- **Dates**: Tests may check date selector behavior
- **Devices**: Settings tests may check device list

## Configuration

Playwright configuration: `playwright.config.ts`

Key settings:
- **Base URL**: `http://localhost:3000`
- **Web server**: Auto-starts dev server (`npm run dev`)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries in CI, 0 locally
- **Screenshots**: Captured on failure
- **Traces**: Captured on first retry

## Debugging Tests

### View test report

```bash
npx playwright show-report
```

### Run with headed browser (see what's happening)

```bash
npx playwright test --headed
```

### Use Playwright Inspector

```bash
npx playwright test --debug
```

### Check screenshots on failure

Failed tests automatically capture screenshots in `test-results/`

## Test Structure

```
e2e/
├── fixtures/
│   └── auth.ts           # Authentication helpers and WebAuthn mocking
├── tab-switching.spec.ts # Tab switching behavior tests
├── idle-refresh.spec.ts  # Auto-refresh after idle tests
├── error-recovery.spec.ts # Error handling tests
└── README.md            # This file
```

## Implementation Notes

### WebAuthn Mocking

Tests mock the WebAuthn API (`navigator.credentials`) since Playwright can't access hardware security keys or platform authenticators:

```typescript
import { mockWebAuthn } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await mockWebAuthn(page);
});
```

### Visibility API Testing

The idle-refresh tests simulate the Page Visibility API:

```typescript
// Hide page
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', {
    value: 'hidden',
  });
  document.dispatchEvent(new Event('visibilitychange'));
});

// Mock time passing
await page.evaluate(() => {
  Date.now = () => originalTime + 31000; // +31 seconds
});

// Show page again
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
  });
  document.dispatchEvent(new Event('visibilitychange'));
});
```

### Network Request Mocking

Tests can mock API responses to simulate errors:

```typescript
await page.route('**/api/habits*', (route) => {
  route.fulfill({
    status: 500,
    body: JSON.stringify({ error: 'Server error' }),
  });
});
```

## Future Enhancements

1. **Authentication Automation**
   - Set up test user with saved auth state
   - OR implement test mode that bypasses real authentication

2. **Test Data Management**
   - Seed test database with known data
   - Reset state between tests
   - Use isolated test accounts

3. **Additional Test Scenarios**
   - Complete habit workflows (create, complete, edit, delete)
   - Timer operations
   - Date navigation
   - Working days logic (weekends, holidays, day-offs)
   - Multi-device scenarios
   - Stats calculations

4. **Visual Regression Testing**
   - Add screenshot comparison tests
   - Verify UI doesn't change unexpectedly

5. **Performance Testing**
   - Measure page load times
   - Check for memory leaks
   - Validate API response times

6. **Accessibility Testing**
   - ARIA labels
   - Keyboard navigation
   - Screen reader compatibility

## Related

- Issue [#15](https://github.com/MrHarigo/daily/issues/15): Add E2E tests
- PR review feedback from PR #2

## Troubleshooting

### Tests timing out

- Increase timeout in `playwright.config.ts`
- Check if dev server is running properly
- Verify database connection

### Tests skipping due to authentication

- See "Authentication Required" section above
- Consider running tests manually after logging in
- OR implement auth fixtures

### WebAuthn errors

- Ensure `mockWebAuthn` is called in `beforeEach`
- Check browser console for credential API errors

### Network request not being mocked

- Ensure route is set up before navigation
- Check URL pattern matches actual API calls
- Use `await page.waitForTimeout()` after setting up routes
