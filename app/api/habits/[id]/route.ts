import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getScheduledWorkingDays, calculateStreak } from '@/lib/stats-utils';
import { getTodayLocal, addDays } from '@/lib/date-utils';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    let { name, type, target_value, sort_order, scheduled_days } = await request.json();

    // Validate scheduled_days if provided
    if (scheduled_days !== undefined) {
      if (scheduled_days !== null) {
        if (!Array.isArray(scheduled_days)) {
          return NextResponse.json({ error: 'scheduled_days must be an array' }, { status: 400 });
        }
        if (scheduled_days.length === 0) {
          return NextResponse.json({ error: 'At least one day must be selected' }, { status: 400 });
        }
        if (!scheduled_days.every(d => Number.isInteger(d) && d >= 1 && d <= 5)) {
          return NextResponse.json({ error: 'scheduled_days must contain only weekdays (1-5)' }, { status: 400 });
        }
        // Remove duplicates and sort
        scheduled_days = [...new Set(scheduled_days)].sort();
      }
    }

    // Fetch current habit to check if schedule is changing
    const currentHabit = await queryOne<{
      id: string;
      scheduled_days: number[] | null;
      created_at: string;
      streak_frozen_at: string | null;
      frozen_streak: number;
    }>(
      `SELECT id, scheduled_days, to_char(created_at, 'YYYY-MM-DD') as created_at,
              to_char(streak_frozen_at, 'YYYY-MM-DD') as streak_frozen_at,
              frozen_streak
       FROM habits WHERE id = $1 AND user_id = $2`,
      [id, auth.userId]
    );

    if (!currentHabit) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let freezeStreak: number | undefined;
    let freezeDate: string | undefined;

    // Check if schedule is changing
    if (scheduled_days !== undefined) {
      const oldSchedule = currentHabit.scheduled_days;
      const newSchedule = scheduled_days;

      const scheduleChanged = JSON.stringify(oldSchedule) !== JSON.stringify(newSchedule);

      if (scheduleChanged) {
        // Calculate current streak before changing schedule
        const today = new Date();
        const startDate = new Date(today);
        const baseDate = currentHabit.streak_frozen_at || currentHabit.created_at;
        startDate.setDate(today.getDate() - 89);

        const holidaysData = await query<{ date: string }>(
          `SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`
        );
        const dayOffsData = await query<{ date: string }>(
          `SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs WHERE user_id = $1`,
          [auth.userId]
        );

        const holidays = new Set(holidaysData.map(h => h.date));
        const dayOffs = new Set(dayOffsData.map(d => d.date));

        const scheduledWorkingDays = getScheduledWorkingDays(
          startDate,
          today,
          oldSchedule,
          holidays,
          dayOffs
        );

        const completions = await query<{ date: string; completed: boolean }>(
          `SELECT to_char(date, 'YYYY-MM-DD') as date, completed
           FROM habit_completions WHERE habit_id = $1`,
          [id]
        );

        const currentStreak = calculateStreak(
          completions,
          scheduledWorkingDays,
          baseDate,
          getTodayLocal()
        );

        // Freeze the streak: add current streak to any existing frozen streak
        freezeStreak = (currentHabit.frozen_streak || 0) + currentStreak;

        // Freeze at end of previous day to avoid same-day edge case
        // (if user changes schedule before completing today, today can still count)
        freezeDate = addDays(getTodayLocal(), -1);
      }
    }

    const habit = await queryOne(
      `UPDATE habits SET
         name = COALESCE($1, name),
         type = COALESCE($2, type),
         target_value = COALESCE($3, target_value),
         sort_order = COALESCE($4, sort_order),
         scheduled_days = COALESCE($5, scheduled_days),
         frozen_streak = COALESCE($6, frozen_streak),
         streak_frozen_at = COALESCE($7::date, streak_frozen_at)
       WHERE id = $8 AND user_id = $9 AND archived_at IS NULL
       RETURNING id, name, type, target_value, sort_order, scheduled_days,
                 frozen_streak, to_char(streak_frozen_at, 'YYYY-MM-DD') as streak_frozen_at,
                 to_char(created_at, 'YYYY-MM-DD') as created_at`,
      [name, type, target_value, sort_order, scheduled_days, freezeStreak, freezeDate, id, auth.userId]
    );

    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(habit);
  } catch (error) {
    console.error('Update habit error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    
    // First verify ownership
    const habit = await queryOne<{ id: string }>(
      'SELECT id FROM habits WHERE id = $1 AND user_id = $2',
      [id, auth.userId]
    );
    
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await query('DELETE FROM habit_completions WHERE habit_id = $1', [id]);
    await query('DELETE FROM active_timers WHERE habit_id = $1', [id]);
    await query('DELETE FROM habits WHERE id = $1', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
