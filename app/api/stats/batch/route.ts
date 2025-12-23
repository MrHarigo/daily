import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function isWorkingDay(date: Date, holidays: Set<string>, dayOffs: Set<string>): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const dateStr = date.toISOString().split('T')[0];
  return !holidays.has(dateStr) && !dayOffs.has(dateStr);
}

function calculateStreak(
  completions: { date: string; completed: boolean }[],
  workingDays: string[],
  habitCreatedAt: string,
  todayStr: string
): number {
  let streak = 0;
  const completionMap = new Map(completions.map(c => [c.date, c.completed]));

  let startIdx = workingDays.length - 1;
  const lastWorkingDay = workingDays[startIdx];
  if (lastWorkingDay === todayStr && !completionMap.get(todayStr)) {
    startIdx--;
  }

  for (let i = startIdx; i >= 0; i--) {
    const day = workingDays[i];
    if (day < habitCreatedAt) break;
    if (completionMap.get(day)) streak++;
    else break;
  }
  return streak;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const habitIds = searchParams.get('habitIds')?.split(',').filter(Boolean);

    if (!habitIds || habitIds.length === 0) {
      return NextResponse.json({ error: 'habitIds parameter required' }, { status: 400 });
    }

    // Verify ownership and fetch all habits at once
    const habits = await query<{ id: string; type: string; created_at: Date }>(
      `SELECT id, type, created_at FROM habits WHERE id = ANY($1) AND user_id = $2`,
      [habitIds, auth.userId]
    );

    if (habits.length === 0) {
      return NextResponse.json({});
    }

    const habitIdSet = new Set(habits.map(h => h.id));

    // Fetch all completions for all habits at once
    const completions = await query<{ habit_id: string; date: string; value: number; completed: boolean }>(
      `SELECT habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed
       FROM habit_completions
       WHERE habit_id = ANY($1)`,
      [habitIds]
    );

    // Fetch holidays and day-offs once (shared for all habits)
    const holidaysData = await query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`);
    const dayOffsData = await query<{ date: string }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs WHERE user_id = $1`,
      [auth.userId]
    );

    const holidays = new Set(holidaysData.map(h => h.date));
    const dayOffs = new Set(dayOffsData.map(d => d.date));

    // Calculate working days once (shared for all habits)
    const today = new Date();
    const workingDays: string[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (isWorkingDay(d, holidays, dayOffs)) {
        workingDays.push(d.toISOString().split('T')[0]);
      }
    }

    const todayStr = today.toISOString().split('T')[0];

    // Group completions by habit
    const completionsByHabit = new Map<string, typeof completions>();
    for (const completion of completions) {
      if (!completionsByHabit.has(completion.habit_id)) {
        completionsByHabit.set(completion.habit_id, []);
      }
      completionsByHabit.get(completion.habit_id)!.push(completion);
    }

    // Calculate stats for each habit
    const result: Record<string, {
      currentStreak: number;
      completedToday: boolean;
      totalCompletions: number;
      totalTime?: number;
      totalCount?: number;
    }> = {};

    for (const habit of habits) {
      const habitCompletions = completionsByHabit.get(habit.id) || [];
      const createdAt = habit.created_at instanceof Date
        ? habit.created_at.toISOString().split('T')[0]
        : String(habit.created_at).split('T')[0];

      // Calculate streak
      const streak = calculateStreak(
        habitCompletions.map(c => ({ date: c.date, completed: c.completed })),
        workingDays,
        createdAt,
        todayStr
      );

      // Total count/time/completions
      let totalTime = 0;
      let totalCount = 0;
      let totalCompletions = 0;
      for (const c of habitCompletions) {
        if (c.completed) totalCompletions++;
        if (habit.type === 'time') totalTime += c.value;
        else if (habit.type === 'count') totalCount += c.value;
      }

      // Check if completed today
      const completedToday = habitCompletions.some(c => c.date === todayStr && c.completed);

      result[habit.id] = {
        currentStreak: streak,
        completedToday,
        totalCompletions,
        totalTime: habit.type === 'time' ? totalTime : undefined,
        totalCount: habit.type === 'count' ? totalCount : undefined,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Batch stats error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
