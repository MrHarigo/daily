# Automated E2E Testing (No Manual Actions!)

## 🚀 Quick Start - Fully Automated

```bash
# One-time setup (create test user)
npm run db:seed-test-user

# Run tests - completely automated!
npm run test:e2e:auto
```

**No browser opens. No manual login. Just runs!** 🎉

---

## How It Works

### 1. Test Login Endpoint
`/api/auth/test-login` - Bypasses passkey authentication

**Security:** Only works in development (`NODE_ENV !== 'production'`)

```typescript
// Sets session directly for test user
POST /api/auth/test-login
Body: { email: "e2e-test@example.com" }

// Returns authenticated session
```

### 2. Test User Seeder
Creates test account with sample data:
- Email: `e2e-test@example.com`
- Username: `E2E Test User`
- 3 sample habits (boolean, count, time types)

### 3. Automated Global Setup
Uses test endpoint to authenticate headlessly - no browser interaction needed!

---

## Setup & Usage

### Initial Setup (One Time)

```bash
# 1. Create test user in database
npm run db:seed-test-user
```

**Output:**
```
🌱 Seeding test user for E2E tests...

✅ Test user created successfully:
   ID:       550e8400-e29b-41d4-a716-446655440000
   Email:    e2e-test@example.com
   Username: E2E Test User

✅ Created 3 sample habits

╔════════════════════════════════════════════════════════════╗
║  Test User Ready!                                          ║
╚════════════════════════════════════════════════════════════╝
```

### Run Automated Tests

```bash
# Headless mode (fast, for CI)
npm run test:e2e:auto

# UI mode (interactive debugging)
npm run test:e2e:auto:ui
```

---

## Comparison: Manual vs Automated

### Manual Authentication (Original)
```bash
npm run test:e2e:auth
```
- ✅ Uses real passkey flow
- ⏱️ Requires manual login (first time)
- 👀 Browser opens visibly
- 💾 Session saved for 30 days

**Best for:** Real-world authentication testing

### Automated Authentication (New!)
```bash
npm run test:e2e:auto
```
- ✅ No manual interaction
- ⚡ Instant authentication
- 👻 Runs headless
- 🤖 Perfect for CI/CD

**Best for:** Fast iteration, CI pipelines, development

---

## Command Reference

```bash
# Setup
npm run db:seed-test-user          # Create test user (one time)

# Automated tests
npm run test:e2e:auto              # Headless automated
npm run test:e2e:auto:ui           # UI mode automated

# Manual tests (original)
npm run test:e2e:auth              # Manual login (browser opens)
npm run test:e2e:auth:ui           # UI mode manual

# Unauthenticated tests
npm run test:e2e                   # Skip auth-required tests
```

---

## Test Output

```bash
$ npm run test:e2e:auto

🤖 Automated authentication setup...
   Base URL: http://localhost:3000
   Test user: e2e-test@example.com

   ✅ Test login endpoint available
   ✅ Authenticated as: E2E Test User
   ✅ Dashboard loaded successfully
   💾 Auth state saved to e2e/.auth/user.json
   🎉 Automated authentication complete!

Running 19 tests using 6 workers

  ✓ [chromium] › tab-switching.spec.ts:23 › should switch between tabs (2.1s)
  ✓ [chromium] › idle-refresh.spec.ts:29 › should refetch after 30s (1.8s)
  ✓ [chromium] › error-recovery.spec.ts:28 › should handle session expiration (1.5s)
  ...

  19 passed (8.2s)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Playwright Test Runner                                 │
│                                                          │
│  1. Reads E2E_AUTOMATED=1 flag                         │
│  2. Runs global-setup-automated.ts                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  global-setup-automated.ts                              │
│                                                          │
│  1. Launch headless browser                            │
│  2. POST /api/auth/test-login                          │
│  3. Verify dashboard visible                           │
│  4. Save auth state                                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  /api/auth/test-login                                   │
│                                                          │
│  1. Check NODE_ENV !== 'production' ✓                  │
│  2. Find user in database                              │
│  3. Set session.userId                                 │
│  4. Return success                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  All tests run with authenticated state                 │
│  e2e/.auth/user.json contains session                   │
└─────────────────────────────────────────────────────────┘
```

---

## Files Created

```
app/api/auth/test-login/route.ts   # Test authentication endpoint
scripts/seed-test-user.ts           # Test user seeder
e2e/global-setup-automated.ts       # Automated auth setup
```

**Configuration:**
- `playwright.config.ts` - Selects automated setup when `E2E_AUTOMATED=1`
- `package.json` - New scripts: `test:e2e:auto`, `db:seed-test-user`

---

## Security

### ✅ Safe
- Test endpoint **only** works in development
- Blocked in production: `NODE_ENV === 'production'`
- Test user has no access to real data
- Separate test database recommended

### ❌ Never Do This
```javascript
// BAD - Don't disable check in production!
if (process.env.NODE_ENV === 'production') {
  // return NextResponse.json({ error: ... })  ❌ DON'T REMOVE THIS
}
```

### Best Practices
1. Use separate test database
2. Delete test users after tests
3. Rotate test credentials regularly
4. Never commit test credentials to git
5. Use different test endpoint URL in production code

---

## Troubleshooting

### Error: "Test login not available"
**Cause:** Running in production mode
**Solution:**
```bash
# Check environment
echo $NODE_ENV  # Should NOT be 'production'

# Unset if needed
unset NODE_ENV
```

### Error: "User not found"
**Cause:** Test user not created
**Solution:**
```bash
npm run db:seed-test-user
```

### Error: "Dashboard not visible"
**Cause:** Authentication succeeded but app not loading
**Solution:**
1. Check dev server is running: `npm run dev`
2. Check database connection
3. Try manual auth to verify: `npm run test:e2e:auth`

### Tests still opening browser
**Cause:** Not using automated mode
**Solution:**
```bash
# Wrong (manual)
npm run test:e2e:auth

# Right (automated)
npm run test:e2e:auto
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm install

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Setup Database
        run: |
          npm run db:migrate
          npm run db:seed-test-user
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Run E2E Tests (Automated)
        run: npm run test:e2e:auto
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Migration Guide

### From Manual to Automated

**Before:**
```bash
# Required manual login each time
npm run test:e2e:auth
# 🌐 Browser opens
# 🔐 You login manually
# ✅ Tests run
```

**After:**
```bash
# One-time setup
npm run db:seed-test-user

# Then always instant
npm run test:e2e:auto
# 🤖 Automatic
# ⚡ Instant
# ✅ Tests run
```

### Keep Both!

You can use both approaches:

```bash
# Automated (fast, CI)
npm run test:e2e:auto

# Manual (real auth flow)
npm run test:e2e:auth
```

**Recommendation:**
- Development: Use `test:e2e:auto` (fast)
- Final verification: Use `test:e2e:auth` (real auth)
- CI/CD: Use `test:e2e:auto` (no interaction needed)

---

## Advanced: Custom Test Users

Create multiple test users for different scenarios:

```typescript
// scripts/seed-test-user.ts
const TEST_USERS = [
  {
    email: 'e2e-admin@example.com',
    username: 'E2E Admin',
    habits: [...] // Many habits
  },
  {
    email: 'e2e-newuser@example.com',
    username: 'E2E New User',
    habits: [] // No habits
  },
];
```

Then in tests:
```typescript
// Login as different user
await page.request.post('/api/auth/test-login', {
  data: { email: 'e2e-newuser@example.com' }
});
```

---

## Summary

✅ **Fully automated testing - no manual actions needed!**

**Setup once:**
```bash
npm run db:seed-test-user
```

**Run anytime:**
```bash
npm run test:e2e:auto
```

**Result:**
- 🚀 Instant authentication
- 🤖 No manual interaction
- ⚡ Fast test execution
- ✅ Perfect for CI/CD

**All 19 tests now run automatically!**
