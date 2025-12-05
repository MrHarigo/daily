-- Daily Habits Database Schema
-- Run this on your Neon database to create the required tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WebAuthn credentials
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  transports TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habits
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'boolean' CHECK (type IN ('boolean', 'count', 'time')),
  target_value INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paused_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Habit completions (daily records)
CREATE TABLE IF NOT EXISTS habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(habit_id, date)
);

-- Active timers (for time-based habits)
CREATE TABLE IF NOT EXISTS active_timers (
  habit_id UUID PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  accumulated_seconds INTEGER DEFAULT 0,
  is_running BOOLEAN DEFAULT FALSE
);

-- Japanese holidays cache
CREATE TABLE IF NOT EXISTS holidays (
  date DATE PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Custom day-offs
CREATE TABLE IF NOT EXISTS day_offs (
  date DATE PRIMARY KEY,
  reason VARCHAR(255)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_archived ON habits(archived_at);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON habit_completions(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date);

