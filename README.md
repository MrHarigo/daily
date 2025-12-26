# Daily Habits

A minimal, dark-themed habit tracker for working days, following the Japanese calendar.

## Features

- **Habit Tracking** - Track daily habits with three types:
  - Boolean (done/not done)
  - Count (e.g., 3 times per day)
  - Time (with built-in stopwatch)

- **Working Days Only** - Habits only activate on working weekdays
  - Follows Japanese national holidays (auto-fetched)
  - Custom day-offs support
  - Weekends automatically excluded

- **Streaks & Stats** - Track your progress
  - Current streak with "at risk" indicator
  - Total completions
  - Per-habit statistics

- **Pause & Archive** - Manage habits lifecycle
  - Pause habits (freezes streak)
  - Archive completed goals
  - Restore archived habits

- **Multi-Tenant & Multi-Device** - Full account management
  - Email-based authentication with 6-digit codes
  - WebAuthn/Passkeys (Touch ID on Mac) for fast login
  - Multiple devices per account
  - Device management in settings

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Neon)
- **Auth**: Email codes + WebAuthn with SimpleWebAuthn
- **Email**: Resend
- **Styling**: Tailwind CSS v4
- **State**: Zustand

## Setup

1. Clone and install:
```bash
npm install
```

2. Create `.env.local`:
```env
# Database (Neon PostgreSQL)
DATABASE_URL=your_neon_database_url

# Session secret (min 32 characters)
SESSION_SECRET=your_32_char_secret

# Resend API Key (for email verification)
RESEND_API_KEY=re_your_api_key

# WebAuthn settings
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000
```

3. Run migrations:
```bash
npm run db:migrate
```

4. Start dev server:
```bash
npm run dev
```

## Development

### Code Quality

This project uses automated code quality checks to maintain consistency:

- **Pre-commit Hook**: Automatically runs ESLint + TypeScript checks on staged files before each commit
  - Installed automatically via `npm install` (runs the `prepare` script)
  - Uses `lint-staged` for fast checks (only staged files)
  - Takes ~1-5 seconds for most commits
  - Auto-fixes ESLint issues with `--fix`
  - Bypass if needed: `git commit --no-verify`

- **GitHub Actions CI**: Runs same checks on all PRs and pushes to main
  - Ensures code quality even if pre-commit hook is bypassed
  - Blocks merging if checks fail

### Manual Hook Installation

If the pre-commit hook isn't working:

```bash
ln -sf ../../.github/hooks/pre-commit .git/hooks/pre-commit
```

See [.github/hooks/README.md](.github/hooks/README.md) for more details.

### Running Checks Manually

```bash
npm run lint              # ESLint
npx tsc --noEmit         # TypeScript type checking
```

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Import repo in Vercel
3. Add environment variables:
   - `DATABASE_URL` - Your Neon connection string
   - `SESSION_SECRET` - 32+ character random string
   - `RESEND_API_KEY` - Your Resend API key
   - `WEBAUTHN_RP_ID` - Your domain (e.g., `your-app.vercel.app`)
   - `WEBAUTHN_ORIGIN` - Full URL (e.g., `https://your-app.vercel.app`)
4. Deploy!

### Getting a Resend API Key

1. Go to [resend.com](https://resend.com) and sign up
2. Go to API Keys and create a new key
3. Copy the key (starts with `re_`)
4. Add it to your environment variables

**Note**: 
- WebAuthn passkeys are domain-specific. You'll need to register a new passkey on each domain (localhost, production, etc.)
- The free Resend tier allows 100 emails/day which is plenty for personal use
