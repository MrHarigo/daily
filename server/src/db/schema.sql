-- Daily Habit Tracker Schema

-- Users table (for WebAuthn)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WebAuthn credentials
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT[], -- Array of transports (usb, nfc, ble, internal, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit types enum
CREATE TYPE habit_type AS ENUM ('boolean', 'count', 'time');

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type habit_type NOT NULL DEFAULT 'boolean',
  target_value INTEGER, -- For count: number of times, for time: minutes
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Habit completions (daily tracking)
CREATE TABLE IF NOT EXISTS habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value INTEGER NOT NULL DEFAULT 0, -- For boolean: 1/0, count: actual count, time: seconds
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, date)
);

-- Japanese holidays cache
CREATE TABLE IF NOT EXISTS holidays (
  date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  year INTEGER NOT NULL
);

-- Custom day-offs
CREATE TABLE IF NOT EXISTS day_offs (
  date DATE PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active timers (for stopwatch state persistence)
CREATE TABLE IF NOT EXISTS active_timers (
  habit_id UUID PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  accumulated_seconds INTEGER NOT NULL DEFAULT 0, -- Time before current session
  is_running BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON habit_completions(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);
CREATE INDEX IF NOT EXISTS idx_habits_archived ON habits(archived_at) WHERE archived_at IS NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for habit_completions
DROP TRIGGER IF EXISTS update_habit_completions_updated_at ON habit_completions;
CREATE TRIGGER update_habit_completions_updated_at
  BEFORE UPDATE ON habit_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- Add paused_at column to habits (run this migration)
-- ALTER TABLE habits ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
