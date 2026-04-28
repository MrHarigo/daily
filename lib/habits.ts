export const HABIT_RETURNING_COLS = `
  id, name, type, target_value, sort_order,
  to_char(created_at, 'YYYY-MM-DD') as created_at,
  to_char(paused_at, 'YYYY-MM-DD"T"HH24:MI:SS') as paused_at,
  to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS') as archived_at,
  scheduled_days, to_char(streak_frozen_at, 'YYYY-MM-DD') as streak_frozen_at, frozen_streak
`;
