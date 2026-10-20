import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { computeHabitStats } from '@/lib/stats-utils';
import { getTodayLocal, addDays, formatLocalDate, parseLocalDate } from '@/lib/date-utils';
import { HABIT_RETURNING_COLS, HabitRow } from '@/lib/habits';

const MAX_DAYS = 3660;

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && formatLocalDate(parseLocalDate(s)) === s;

/**
 * GET /api/stats?today=YYYY-MM-DD&days=30
 * today: the client's local date (the server clock may be in another timezone)
 * days: range length ending today; 0 = since the oldest habit was created
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const today = searchParams.get('today') ?? getTodayLocal();
    const days = Number(searchParams.get('days') ?? 30);

    if (!isValidDate(today)) {
      return NextResponse.json({ error: 'today must be a YYYY-MM-DD date' }, { status: 400 });
    }
    if (!Number.isInteger(days) || days < 0 || days > MAX_DAYS) {
      return NextResponse.json({ error: `days must be an integer between 0 and ${MAX_DAYS}` }, { status: 400 });
    }

    const [habits, completions, holidaysData, dayOffsData] = await Promise.all([
      query<HabitRow>(
        `SELECT ${HABIT_RETURNING_COLS} FROM habits WHERE user_id = $1 ORDER BY sort_order, created_at`,
        [auth.userId]
      ),
      query<{ habit_id: string; date: string; value: number; completed: boolean }>(
        `SELECT hc.habit_id, to_char(hc.date, 'YYYY-MM-DD') as date, hc.value, hc.completed
         FROM habit_completions hc
         INNER JOIN habits h ON hc.habit_id = h.id
         WHERE h.user_id = $1`,
        [auth.userId]
      ),
      query<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`),
      query<{ date: string }>(
        `SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs WHERE user_id = $1`,
        [auth.userId]
      ),
    ]);

    const holidays = new Set(holidaysData.map(h => h.date));
    const dayOffs = new Set(dayOffsData.map(d => d.date));

    const oldest = habits.reduce((min, h) => (h.created_at < min ? h.created_at : min), today);
    const from = days === 0 ? oldest : addDays(today, -(days - 1));

    const completionsByHabit = new Map<string, typeof completions>();
    for (const c of completions) {
      if (!completionsByHabit.has(c.habit_id)) completionsByHabit.set(c.habit_id, []);
      completionsByHabit.get(c.habit_id)!.push(c);
    }

    const offDays = [...holidays, ...dayOffs].filter(d => d >= from && d <= today);

    return NextResponse.json({
      today,
      from,
      offDays,
      habits: habits.map(h => ({
        ...h,
        stats: computeHabitStats(h, completionsByHabit.get(h.id) ?? [], holidays, dayOffs, from, today),
      })),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
