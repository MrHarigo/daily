import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function isWorkingDay(date: Date, holidays: Set<string>, dayOffs: Set<string>): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const dateStr = date.toISOString().split('T')[0];
  return !holidays.has(dateStr) && !dayOffs.has(dateStr);
}

function calculateStreak(completions: { date: string; completed: boolean }[], workingDays: string[], habitCreatedAt: string, todayStr: string): number {
  let streak = 0;
  const completionMap = new Map(completions.map(c => [c.date, c.completed]));
  
  // Start from today and work backwards
  let startIdx = workingDays.length - 1;
  
  // If today is a working day but not completed, skip it and start from yesterday
  // This way we show the "active" streak that can still be extended
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

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const habits = await query<{ id: string; created_at: Date }>('SELECT id, created_at FROM habits WHERE archived_at IS NULL AND paused_at IS NULL');
    const completions = await query<{ habit_id: string; date: string; completed: boolean }>(
      `SELECT habit_id, to_char(date, 'YYYY-MM-DD') as date, completed FROM habit_completions`
    );
    const holidaysData = await query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`);
    const dayOffsData = await query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs`);

    const holidays = new Set(holidaysData.map(h => h.date));
    const dayOffs = new Set(dayOffsData.map(d => d.date));

    // Get working days for last 90 days
    const today = new Date();
    const workingDays: string[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (isWorkingDay(d, holidays, dayOffs)) {
        workingDays.push(d.toISOString().split('T')[0]);
      }
    }

    // Find best current streak across all habits
    const todayStr = today.toISOString().split('T')[0];
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
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

