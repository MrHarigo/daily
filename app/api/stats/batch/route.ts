import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isWorkingDay, calculateStreak } from '@/lib/stats-utils';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const habitIdsRaw = searchParams.get('habitIds')?.split(',').filter(Boolean);

    if (!habitIdsRaw || habitIdsRaw.length === 0) {
      return NextResponse.json({ error: 'habitIds parameter required' }, { status: 400 });
    }

    // Deduplicate and validate UUIDs (PostgreSQL uses lowercase UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const habitIds = Array.from(new Set(habitIdsRaw)).filter(id => uuidRegex.test(id));

    if (habitIds.length === 0) {
      return NextResponse.json({ error: 'No valid habit IDs provided' }, { status: 400 });
    }

    if (habitIds.length > 50) {
      return NextResponse.json({ error: 'Too many habit IDs (max 50)' }, { status: 400 });
    }

    // Verify ownership and fetch all habits at once
    const habits = await query<{ id: string; type: string; created_at: string }>(
      `SELECT id, type, to_char(created_at, 'YYYY-MM-DD') as created_at FROM habits WHERE id = ANY($1) AND user_id = $2`,
      [habitIds, auth.userId]
    );

    if (habits.length === 0) {
      return NextResponse.json({});
    }

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
      const createdAt = habit.created_at; // Already formatted as YYYY-MM-DD from query

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
  } catch (err) {
    console.error('Batch stats error:', err);
    return NextResponse.json({ error: 'Failed to fetch batch stats' }, { status: 500 });
  }
}
