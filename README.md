# Daily - Habit Tracker

A personal habit tracker with Japanese calendar support, Touch ID authentication, and streak tracking.

## Features

- **Habit Tracking**: Track daily habits with three types:
  - ✓ **Boolean**: Simple done/not done checkboxes
  - 🔢 **Count**: Track number of times (with +/- buttons)
  - ⏱ **Timer**: Stopwatch with pause/resume for timed activities

- **Japanese Calendar**: Automatically fetches and caches Japanese national holidays. Habits are paused on non-working days.

- **Custom Day-offs**: Mark additional days off (vacations, sick days, etc.)

- **Streaks & Stats**: Track your completion streaks. Non-working days pause streaks without breaking them.

- **Touch ID Authentication**: Secure access using WebAuthn (fingerprint/Face ID)

- **Dark Mode**: Clean, minimal, tech-inspired dark UI

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon)
- **Auth**: WebAuthn (passkeys)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)

### 1. Clone and Install

```bash
cd daily
npm install
cd client && npm install
cd ../server && npm install
cd ..
```

### 2. Configure Environment

Create `server/.env`:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://username:password@your-neon-host.neon.tech/daily?sslmode=require

# Server
PORT=3001
NODE_ENV=development

# WebAuthn
WEBAUTHN_RP_NAME=Daily Tracker
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:5173

# Session secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your-random-secret-here
```

### 3. Set Up Database

Run the migrations to create tables:

```bash
cd server
npm run db:migrate
```

### 4. Start Development

From the root directory:

```bash
npm run dev
```

This starts both the frontend (http://localhost:5173) and backend (http://localhost:3001).

## Usage

### First Time Setup

1. Open http://localhost:5173
2. Enter your name and register with Touch ID
3. You're in! Start adding habits.

### Adding Habits

Click "Add new habit" and choose:
- **Check off**: For yes/no habits (e.g., "Take vitamins")
- **Count**: For counted habits (e.g., "Drink 8 glasses of water")
- **Timer**: For timed habits (e.g., "30 min reading")

### Tracking

- **Boolean habits**: Click the checkbox to mark complete
- **Count habits**: Use +/- buttons to increment/decrement
- **Timer habits**: Click "Timer" to expand, then Start/Pause/Stop

### Non-Working Days

Habits are automatically paused on:
- Weekends (Saturday & Sunday)
- Japanese national holidays
- Custom day-offs you set in Settings

Your streaks won't be broken on these days!

## Project Structure

```
daily/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand stores
│   │   └── lib/            # Utilities
│   └── ...
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   └── db/             # Database setup
│   └── ...
└── package.json            # Root package
```

## API Endpoints

### Auth
- `GET /api/auth/status` - Check auth status
- `POST /api/auth/register/options` - Get WebAuthn registration options
- `POST /api/auth/register/verify` - Verify registration
- `POST /api/auth/login/options` - Get WebAuthn login options
- `POST /api/auth/login/verify` - Verify login
- `POST /api/auth/logout` - Logout

### Habits
- `GET /api/habits` - List habits
- `POST /api/habits` - Create habit
- `PUT /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Archive habit
- `GET /api/habits/completions` - Get completions for date range
- `POST /api/habits/:id/completion` - Update completion
- `POST /api/habits/:id/increment` - Increment count
- `POST /api/habits/:id/timer/start` - Start timer
- `POST /api/habits/:id/timer/pause` - Pause timer
- `POST /api/habits/:id/timer/stop` - Stop timer and save

### Calendar
- `GET /api/calendar/holidays/:year` - Get Japanese holidays
- `GET /api/calendar/day-offs` - Get custom day-offs
- `POST /api/calendar/day-offs` - Add day-off
- `DELETE /api/calendar/day-offs/:date` - Remove day-off

### Stats
- `GET /api/stats/overview` - Get overall statistics
- `GET /api/stats/habit/:id` - Get habit-specific stats

## Future Expansion

The architecture is designed to be extensible. Planned features:
- Daily to-do list (one-off tasks)
- Work/Pomodoro timer
- Activity time tracking
- Widgets and dashboard customization

---

Built with ❤️ for productive days.

