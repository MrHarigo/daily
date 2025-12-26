import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calculateStreak, getScheduledWorkingDays } from '@/lib/stats-utils';
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    // Filter by user_id
    const habits = await query<{ id: string; created_at: Date; scheduled_days: number[] | null; frozen_streak: number; streak_frozen_at: Date | null }>(
      'SELECT id, created_at, scheduled_days, frozen_streak, streak_frozen_at FROM habits WHERE user_id = $1 AND archived_at IS NULL AND paused_at IS NULL',
      [auth.userId]
    );
    
    const completions = await query<{ habit_id: string; date: string; completed: boolean }>(
      `SELECT hc.habit_id, to_char(hc.date, 'YYYY-MM-DD') as date, hc.completed 
       FROM habit_completions hc
       INNER JOIN habits h ON hc.habit_id = h.id
       WHERE h.user_id = $1`,
      [auth.userId]
    );
    
    const holidaysData = await query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`);
    const dayOffsData = await query<{ date: string }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs WHERE user_id = $1`,
      [auth.userId]
    );

    const holidays = new Set(holidaysData.map(h => h.date));
    const dayOffs = new Set(dayOffsData.map(d => d.date));

    // Find best current streak across all habits
    const todayStr = getTodayLocal();
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 89); // 90 days back

    let bestStreak = 0;
    let bestStreakCompletedToday = false;

    for (const habit of habits) {
      const habitCompletions = completions.filter(c => c.habit_id === habit.id);

      // Use streak_frozen_at as base date if it exists, otherwise use created_at
      const baseDate = habit.streak_frozen_at
        ? (habit.streak_frozen_at instanceof Date ? formatLocalDate(habit.streak_frozen_at) : String(habit.streak_frozen_at))
        : (habit.created_at instanceof Date ? formatLocalDate(habit.created_at) : String(habit.created_at));
      const frozenStreak = habit.frozen_streak || 0;

      // Get scheduled working days for THIS habit
      const scheduledWorkingDays = getScheduledWorkingDays(
        startDate,
        today,
        habit.scheduled_days,
        holidays,
        dayOffs
      );

      // If streak was frozen, exclude the freeze date to avoid double-counting
      // (the freeze date is already counted in frozen_streak)
      const workingDaysForStreak = habit.streak_frozen_at
        ? scheduledWorkingDays.filter(d => d > baseDate)
        : scheduledWorkingDays;

      // Calculate streak since base date (either creation or last schedule change)
      const streakSinceBase = calculateStreak(habitCompletions, workingDaysForStreak, baseDate, todayStr);

      // Total streak = frozen streak + streak since base date
      const streak = frozenStreak + streakSinceBase;

      if (streak > bestStreak) {
        bestStreak = streak;
        // Check if this habit was completed today
        bestStreakCompletedToday = habitCompletions.some(c => c.date === todayStr && c.completed);
      }
    }

    // Total completions all time
    const totalCompletions = completions.filter(c => c.completed).length;

    return NextResponse.json({
      longestStreak: bestStreak,
      completedToday: bestStreakCompletedToday,
      totalCompletions,
      totalHabits: habits.length,
    });
  } catch (error) {
    console.error('Stats overview error:', error);
    return NextResponse.json({ error: 'Failed to fetch overview stats' }, { status: 500 });
  }
}
