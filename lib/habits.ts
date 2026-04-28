export const HABIT_RETURNING_COLS = `id, name, type, target_value, sort_order,
  to_char(created_at, 'YYYY-MM-DD') as created_at,
  to_char(paused_at, 'YYYY-MM-DD"T"HH24:MI:SS') as paused_at,
  to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS') as archived_at,
  scheduled_days, to_char(streak_frozen_at, 'YYYY-MM-DD') as streak_frozen_at, frozen_streak`;

export interface HabitRow {
  id: string;
  name: string;
  type: string;
  target_value: number | null;
  sort_order: number;
  created_at: string;
  paused_at: string | null;
  archived_at: string | null;
  scheduled_days: number[] | null;
  streak_frozen_at: string | null;
  frozen_streak: number | null;
}
