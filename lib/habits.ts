export const HABIT_RETURNING_COLS = `
  id, name, type, target_value, sort_order,
  to_char(created_at, 'YYYY-MM-DD') as created_at,
  paused_at, archived_at, scheduled_days, streak_frozen_at, frozen_streak
`;
