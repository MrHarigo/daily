# Authentication for E2E Tests

This guide explains how to test functionality behind the login wall.

## Quick Start

### Method 1: Authenticated Tests (Recommended)

Run tests with automatic authentication setup:

```bash
# First run - authenticates and saves session
npm run test:e2e:auth

# This will:
# 1. Open a browser window
# 2. Wait for you to login (Touch ID or email)
# 3. Save your session for future tests
# 4. Run all tests with authentication
```

After the first run, your session is saved in `e2e/.auth/user.json` and reused automatically!

### Method 2: Unauthenticated Tests (Default)

Run tests that skip authenticated functionality:

```bash
npm run test:e2e

# Tests will:
# - Detect login screen
# - Skip tests requiring authentication
# - Run only tests that work without auth
```

---

## Three Approaches Explained

### Approach 1: Global Setup with Saved Auth State ⭐ Recommended

**How it works:**
- First test run: Authenticates once and saves session
- Subsequent runs: Reuses saved session (no login needed)
- Fast and reliable for local development

**Setup:**
```bash
# Run authenticated tests
npm run test:e2e:auth

# First time: Browser opens, you login manually
# After that: Tests run instantly with saved session
```

**When to use:**
- Local development and debugging
- Running full test suite repeatedly
- When you have a test account

**Files:**
- `e2e/global-setup.ts` - Handles authentication setup
- `e2e/.auth/user.json` - Stores session (gitignored)
- `playwright.config.ts` - Configured to use saved state when `E2E_AUTHENTICATED=1`

---

### Approach 2: Test User with API-Based Login

**How it works:**
- Create a dedicated test user account
- Tests authenticate via API before each run
- No manual login required

**Implementation:**

```typescript
// e2e/fixtures/test-user.ts
export const TEST_USER = {
  email: 'test@example.com',
  userId: 'test-user-id-123',
};

// Create helper to authenticate via API
export async function authenticateTestUser(page: Page) {
  // Call your auth API endpoint directly
  const response = await page.request.post('/api/auth/test-login', {
    data: { userId: TEST_USER.userId },
  });

  // Session cookie is automatically set
}
```

**When to use:**
- CI/CD pipelines
- Automated testing environments
- When you need fresh state each run

**Setup required:**
1. Create test endpoint: `app/api/auth/test-login/route.ts`
2. Add test user to database
3. Only enable in test/dev environments

---

### Approach 3: Mock Session Cookie

**How it works:**
- Manually set the session cookie with test data
- Bypasses actual authentication
- Fastest but requires understanding session structure

**Implementation:**

```typescript
// e2e/fixtures/mock-auth.ts
import { Page } from '@playwright/test';

export async function mockAuthSession(page: Page) {
  // Navigate first to set domain
  await page.goto('/');

  // Set session cookie with test user ID
  await page.context().addCookies([
    {
      name: 'daily_session',
      value: createMockSessionValue('test-user-id'),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Reload to apply session
  await page.reload();
}

function createMockSessionValue(userId: string): string {
  // Use iron-session to create encrypted session value
  // This requires the SESSION_SECRET env var
  const session = { userId };
  return encryptSession(session); // Implementation needed
}
```

**When to use:**
- Very fast test execution
- Testing specific edge cases
- When you control the session format

**Challenges:**
- Requires encrypting session data (iron-session)
- Must match production session format
- More brittle if session structure changes

---

## Comparison

| Approach | Speed | Ease of Setup | CI-Friendly | Maintenance |
|----------|-------|---------------|-------------|-------------|
| **Saved Auth State** | ⚡⚡⚡ Fast (after first run) | ✅ Easy | ⚠️ Requires manual setup | ✅ Low |
| **Test User API** | ⚡⚡ Medium | ⚠️ Moderate | ✅ Yes | ⚠️ Medium |
| **Mock Session** | ⚡⚡⚡ Very Fast | ❌ Complex | ✅ Yes | ❌ High |

---

## Recommended Setup for Different Scenarios

### Local Development
```bash
# One-time setup
npm run test:e2e:auth  # Login once

# Daily work
npm run test:e2e:auth  # Uses saved session
```

### CI/CD Pipeline
Option A: Test User API (best)
```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
  run: npm run test:e2e:auth
```

Option B: Saved Auth State (simpler)
```yaml
# Generate auth state in CI setup step
- name: Setup Auth
  run: npx playwright test --grep @auth-setup

- name: Run Tests
  run: E2E_AUTHENTICATED=1 npm run test:e2e
```

### Pull Request Previews
- Use unauthenticated mode: `npm run test:e2e`
- Tests skip authenticated features (expected)
- Fast smoke testing

---

## Testing Strategy

### Current Setup (Default)
```bash
npm run test:e2e
# ✅ 18 tests skip (require auth)
# ✅ 1 test passes (login validation)
```

### With Authentication
```bash
npm run test:e2e:auth
# ✅ All 19 tests run
# ✅ Tests tab switching, auto-refresh, error recovery
```

### Best Practice
1. **Local dev**: Use `test:e2e:auth` with saved state
2. **CI**: Implement test user API approach
3. **Quick checks**: Use `test:e2e` (unauthenticated)

---

## Troubleshooting

### Session expires during tests
**Solution**: Session is valid for 30 days. Re-run `npm run test:e2e:auth` to refresh.

### Tests fail immediately after authentication
**Issue**: Saved state file corrupted or outdated
**Solution**:
```bash
rm -rf e2e/.auth/
npm run test:e2e:auth  # Re-authenticate
```

### "Please authenticate" message doesn't appear
**Issue**: Global setup not running
**Solution**: Check `E2E_AUTHENTICATED=1` is set:
```bash
E2E_AUTHENTICATED=1 npm run test:e2e
```

### Want to test with different user
**Solution**: Delete saved state and re-run:
```bash
rm -rf e2e/.auth/
npm run test:e2e:auth
# Login with different account
```

---

## Security Notes

⚠️ **IMPORTANT:**
- `e2e/.auth/` is gitignored (contains session data)
- Never commit authentication credentials
- Use different test accounts, not production accounts
- Rotate test credentials regularly
- In CI, use secrets management

✅ **Safe practices:**
- Test accounts with limited permissions
- Dedicated test database
- Session expires after tests
- No real user data in tests

---

## Next Steps

### Implement Test User API (For CI)

Create test authentication endpoint:

```typescript
// app/api/auth/test-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';

export async function POST(request: NextRequest) {
  // Only allow in development/test
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const { userId } = await request.json();
  const session = await getIronSession(request, NextResponse.next(), sessionOptions);

  session.userId = userId;
  await session.save();

  return NextResponse.json({ success: true });
}
```

Then use in tests:
```typescript
// In test setup
await page.request.post('/api/auth/test-login', {
  data: { userId: 'test-user-id' },
});
```

### Add Test Database Seeding

Create test data fixtures for consistent testing:

```bash
# scripts/seed-test-db.ts
# - Create test user
# - Add sample habits
# - Set up test scenarios
```

Run before tests:
```json
{
  "scripts": {
    "test:e2e:auth": "tsx scripts/seed-test-db.ts && E2E_AUTHENTICATED=1 playwright test"
  }
}
```
