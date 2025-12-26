# Local Development Setup

## Prerequisites

- Node.js 20+ installed
- A Neon PostgreSQL database (free tier available)

---

## 1. Environment Variables

Create `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your values:

```bash
# Required: Database connection string
DATABASE_URL=postgresql://user:password@host/database

# Required: Session secret (32+ characters)
SESSION_SECRET=your-secret-key-at-least-32-characters-long

# Optional: Email service (for verification codes)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Environment
NODE_ENV=development
```

### Getting Your Database Connection String

#### Option 1: Neon (Recommended - Free Tier Available)

1. Go to https://console.neon.tech
2. Sign up / Log in
3. Create a new project
4. Copy the connection string from the dashboard
5. Paste into `.env.local` as `DATABASE_URL`

**Example:**
```bash
DATABASE_URL=postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

#### Option 2: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
DATABASE_URL=postgresql://localhost:5432/daily
```

### Generating Session Secret

```bash
# Generate a secure random string
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output into your `.env.local`:
```bash
SESSION_SECRET=ZYx1wVuTsRqPoNmLkJiHgFeDcBa9876543210zyxwvu=
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Setup Database

```bash
# Run migrations to create tables
npm run db:migrate

# (Optional) Seed test user for E2E tests
npm run db:seed-test-user
```

**What this does:**
- Creates all necessary tables (users, habits, completions, etc.)
- Sets up indexes for performance
- Prepares database for use

---

## 4. Start Development Server

```bash
npm run dev
```

Server will start at: **http://localhost:3000**

---

## 5. Verify Setup

Open http://localhost:3000 in your browser:

1. You should see the login page
2. Click "Continue with email"
3. Enter your email
4. You'll receive a verification code (if `RESEND_API_KEY` is set)
5. Or check server logs for the code (development mode)

---

## Common Issues

### Error: "No database host or connection string was set"

**Cause:** `DATABASE_URL` not set in `.env.local`

**Solution:**
1. Create `.env.local` file
2. Add `DATABASE_URL=postgresql://...`
3. Restart dev server

### Error: "relation 'users' does not exist"

**Cause:** Database tables not created

**Solution:**
```bash
npm run db:migrate
```

### Error: "Session secret not configured"

**Cause:** `SESSION_SECRET` not set or too short

**Solution:**
1. Generate secret: `openssl rand -base64 32`
2. Add to `.env.local`: `SESSION_SECRET=your_generated_secret`
3. Must be at least 32 characters

### Error: "Failed to send verification code"

**Cause:** `RESEND_API_KEY` not configured

**Solution:** Either:
1. Get API key from https://resend.com (free tier available)
2. Or check server console logs for the code in development mode

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `SESSION_SECRET` | Secret for session encryption (32+ chars) | Generated with `openssl rand -base64 32` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Email service API key | `re_xxxxxxxxxxxxx` |
| `NODE_ENV` | Environment mode | `development` (default) |

---

## Development Workflow

```bash
# Start dev server
npm run dev

# Run linting
npm run lint

# Run E2E tests (unauthenticated)
npm run test:e2e

# Run E2E tests (with manual auth)
npm run test:e2e:auth

# Run E2E tests (fully automated)
npm run test:e2e:auto

# Build for production
npm run build
```

---

## Project Structure

```
daily/
├── .env.local              # Your local environment variables (not committed)
├── .env.local.example      # Template for environment variables
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── auth/          # Authentication endpoints
│   └── page.tsx           # Main app page
├── components/            # React components
├── lib/                   # Utilities
│   ├── db.ts             # Database connection
│   └── session.ts        # Session configuration
├── schema.sql            # Database schema
├── scripts/              # Utility scripts
│   ├── migrate.ts        # Database migrations
│   └── seed-test-user.ts # Test user seeder
└── e2e/                  # E2E tests
    └── *.spec.ts         # Test files
```

---

## Next Steps

1. ✅ Set up `.env.local` with `DATABASE_URL`
2. ✅ Generate and set `SESSION_SECRET`
3. ✅ Run `npm install`
4. ✅ Run `npm run db:migrate`
5. ✅ Start `npm run dev`
6. ✅ Open http://localhost:3000

**For E2E Testing:**
7. Run `npm run db:seed-test-user`
8. Run `npm run test:e2e:auto`

---

## Getting Help

- **Database issues:** Check https://neon.tech/docs
- **Authentication issues:** Verify `SESSION_SECRET` is set
- **E2E test issues:** See `e2e/AUTOMATED-LOGIN.md`

---

## Security Notes

⚠️ **Important:**
- Never commit `.env.local` to git (already in .gitignore)
- Use different `SESSION_SECRET` for each environment
- Use separate databases for development/testing/production
- Rotate secrets regularly
