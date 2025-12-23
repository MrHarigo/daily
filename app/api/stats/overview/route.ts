import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getWorkingDaysWithCache, calculateStreak } from '@/lib/stats-utils';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    // Filter by user_id
    const habits = await query<{ id: string; created_at: Date }>(
      'SELECT id, created_at FROM habits WHERE user_id = $1 AND archived_at IS NULL AND paused_at IS NULL',
      [auth.userId]
    );
    
    const completions = await query<{ habit_id: string; date: string; completed: boolean }>(
      `SELECT hc.habit_id, to_char(hc.date, 'YYYY-MM-DD') as date, hc.completed
       FROM habit_completions hc
       INNER JOIN habits h ON hc.habit_id = h.id
       WHERE h.user_id = $1`,
      [auth.userId]
    );

    // Get working days with caching
    const { workingDays, todayStr } = await getWorkingDaysWithCache(auth.userId, query);

    // Find best current streak across all habits
    let bestStreak = 0;
    let bestStreakCompletedToday = false;

    for (const habit of habits) {
      const habitCompletions = completions.filter(c => c.habit_id === habit.id);
      const createdAt = habit.created_at instanceof Date
        ? habit.created_at.toISOString().split('T')[0]
        : String(habit.created_at).split('T')[0];
      const streak = calculateStreak(habitCompletions, workingDays, createdAt, todayStr);
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
