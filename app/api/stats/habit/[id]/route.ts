import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function isWorkingDay(date: Date, holidays: Set<string>, dayOffs: Set<string>): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const dateStr = date.toISOString().split('T')[0];
  return !holidays.has(dateStr) && !dayOffs.has(dateStr);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  try {
    const habit = await queryOne<{ id: string; type: string; created_at: Date }>(
      'SELECT id, type, created_at FROM habits WHERE id = $1', [id]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const completions = await query<{ date: string; value: number; completed: boolean }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date, value, completed FROM habit_completions WHERE habit_id = $1`, [id]
    );
    const holidaysData = await query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`);
    const dayOffsData = await query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs`);

    const holidays = new Set(holidaysData.map(h => h.date));
    const dayOffs = new Set(dayOffsData.map(d => d.date));

    const createdAt = habit.created_at instanceof Date 
      ? habit.created_at.toISOString().split('T')[0]
      : String(habit.created_at).split('T')[0];

    // Get working days
    const today = new Date();
    const workingDays: string[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (isWorkingDay(d, holidays, dayOffs)) {
        workingDays.push(d.toISOString().split('T')[0]);
      }
    }

    // Calculate streak
    let streak = 0;
    const completionMap = new Map(completions.map(c => [c.date, c.completed]));
    const todayStr = today.toISOString().split('T')[0];
    
    // Start from today, but if today is not completed, skip it to show "active" streak
    let startIdx = workingDays.length - 1;
    const lastWorkingDay = workingDays[startIdx];
    if (lastWorkingDay === todayStr && !completionMap.get(todayStr)) {
      startIdx--;
    }
    
    for (let i = startIdx; i >= 0; i--) {
      const day = workingDays[i];
      if (day < createdAt) break;
      if (completionMap.get(day)) streak++;
      else break;
    }

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
    const completedToday = completionMap.get(todayStr) === true;

    return NextResponse.json({
      currentStreak: streak,
      completedToday,
      totalCompletions,
      totalTime: habit.type === 'time' ? totalTime : undefined,
      totalCount: habit.type === 'count' ? totalCount : undefined,
    });
  } catch (error) {
    console.error('Habit stats error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

