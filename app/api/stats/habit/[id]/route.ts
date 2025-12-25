import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isWorkingDay, calculateStreak, getScheduledWorkingDays } from '@/lib/stats-utils';
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  try {
    // Verify ownership
    const habit = await queryOne<{ id: string; type: string; created_at: Date; scheduled_days: number[] | null; frozen_streak: number; streak_frozen_at: Date | null }>(
      'SELECT id, type, created_at, scheduled_days, frozen_streak, streak_frozen_at FROM habits WHERE id = $1 AND user_id = $2',
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const completions = await query<{ date: string; value: number; completed: boolean }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date, value, completed FROM habit_completions WHERE habit_id = $1`,
      [id]
    );
    const holidaysData = await query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`);
    const dayOffsData = await query<{ date: string }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs WHERE user_id = $1`,
      [auth.userId]
    );

    const holidays = new Set(holidaysData.map(h => h.date));
    const dayOffs = new Set(dayOffsData.map(d => d.date));

    // Use streak_frozen_at as base date if it exists, otherwise use created_at
    const baseDate = habit.streak_frozen_at
      ? (habit.streak_frozen_at instanceof Date ? formatLocalDate(habit.streak_frozen_at) : String(habit.streak_frozen_at))
      : (habit.created_at instanceof Date ? formatLocalDate(habit.created_at) : String(habit.created_at));
    const frozenStreak = habit.frozen_streak || 0;

    // Get scheduled working days for this habit
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 89); // 90 days back

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
    const todayStr = getTodayLocal();
    const streakSinceBase = calculateStreak(
      completions.map(c => ({ date: c.date, completed: c.completed })),
      workingDaysForStreak,
      baseDate,
      todayStr
    );

    // Total streak = frozen streak + streak since base date
    const streak = frozenStreak + streakSinceBase;

    // Total count/time/completions
    let totalTime = 0;
    let totalCount = 0;
    let totalCompletions = 0;
    for (const c of completions) {
      if (c.completed) totalCompletions++;
      if (habit.type === 'time') totalTime += c.value;
      else if (habit.type === 'count') totalCount += c.value;
    }

    // Check if completed today
    const completedToday = completions.some(c => c.date === todayStr && c.completed);

    return NextResponse.json({
      currentStreak: streak,
      completedToday,
      totalCompletions,
      totalTime: habit.type === 'time' ? totalTime : undefined,
      totalCount: habit.type === 'count' ? totalCount : undefined,
    });
  } catch (error) {
    console.error('Habit stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch habit stats' }, { status: 500 });
  }
}
