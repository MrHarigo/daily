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

- **Secure Authentication** - WebAuthn/Passkeys (Touch ID on Mac)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Neon)
- **Auth**: WebAuthn with SimpleWebAuthn
- **Styling**: Tailwind CSS v4
- **State**: Zustand

## Setup

1. Clone and install:
```bash
npm install
```

2. Create `.env.local`:
```env
DATABASE_URL=your_neon_database_url
SESSION_SECRET=your_32_char_secret
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000
```

3. Run migrations (if needed):
```bash
# Connect to your Neon database and run the schema
```

4. Start dev server:
```bash
npm run dev
```

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Import repo in Vercel
3. Add environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `WEBAUTHN_RP_ID` (your domain without https://)
   - `WEBAUTHN_ORIGIN` (full URL with https://)
4. Deploy!

**Note**: WebAuthn passkeys are domain-specific. You'll need to register a new passkey on the production site.