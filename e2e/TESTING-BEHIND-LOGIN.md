# Testing Behind Login Wall - Quick Start

## ✅ Yes, you can test authenticated functionality!

### Option 1: Run Authenticated Tests (Easiest)

```bash
npm run test:e2e:auth
```

**First time:**
1. Browser opens automatically
2. Login manually (Touch ID or email)
3. Tests continue automatically after login
4. Session saved for future runs

**After that:**
- Tests run instantly with saved session
- No login needed again (session valid 30 days)

### Option 2: Manual Setup (Alternative)

```bash
# Generate auth state
npx playwright codegen --save-storage=e2e/.auth/user.json http://localhost:3000

# Then run tests
npm run test:e2e:auth
```

---

## What Gets Tested?

### Without Authentication (Default)
```bash
npm run test:e2e
# 18 tests skip, 1 test passes
```

### With Authentication
```bash
npm run test:e2e:auth
# ALL 19 tests run:
# ✅ Tab switching with data preservation
# ✅ Auto-refresh after 30s idle
# ✅ Error recovery (session expiration, boundaries)
# ✅ Network error handling
# ✅ Habit operations (complete, edit, timer)
# ✅ Settings management
```

---

## Quick Commands

```bash
# Unauthenticated (skips most tests)
npm run test:e2e

# Authenticated (runs all tests)
npm run test:e2e:auth

# Authenticated with UI mode
npm run test:e2e:auth:ui

# Reset authentication
rm -rf e2e/.auth/
npm run test:e2e:auth
```

---

## How It Works

1. **Global Setup** (`e2e/global-setup.ts`)
   - Runs before all tests
   - Waits for you to login
   - Saves session to `e2e/.auth/user.json`

2. **Playwright Config** (`playwright.config.ts`)
   - When `E2E_AUTHENTICATED=1` is set
   - Uses saved session for all tests
   - Tests run as authenticated user

3. **Session Persistence**
   - Session stored in `e2e/.auth/user.json` (gitignored)
   - Valid for 30 days
   - Reused across test runs

---

## Detailed Documentation

See `e2e/AUTHENTICATION.md` for:
- All 3 authentication approaches
- CI/CD setup instructions
- Test user API implementation
- Mock session approach
- Security best practices
- Troubleshooting guide

---

## Example Test Run

```bash
$ npm run test:e2e:auth

🔐 Setting up authentication...
⏳ Please authenticate in the browser window...
   1. Click "Sign in with Touch ID" or "Continue with email"
   2. Complete the authentication flow
   3. Tests will continue automatically once authenticated

✅ Authentication successful!
💾 Auth state saved to e2e/.auth/user.json

Running 19 tests using 6 workers

✓ [chromium] › tab-switching.spec.ts:23 › should switch between all tabs
✓ [chromium] › idle-refresh.spec.ts:29 › should refetch after 30+ seconds
✓ [chromium] › error-recovery.spec.ts:28 › should handle session expiration
...

  19 passed (12.5s)
```

---

## FAQ

**Q: Do I need to login every time?**
A: No! Only the first time. Session is saved for 30 days.

**Q: Can I use different accounts?**
A: Yes! Delete `e2e/.auth/` and re-run to login with different account.

**Q: Will this work in CI?**
A: Yes! See `AUTHENTICATION.md` for CI setup instructions.

**Q: Is my session data safe?**
A: Yes! `e2e/.auth/` is gitignored and never committed.

**Q: What if tests fail after authentication?**
A: Your session might be expired. Delete `e2e/.auth/` and re-authenticate.
