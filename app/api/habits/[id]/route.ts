import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const { name, type, target_value, sort_order } = await request.json();

    // Fetch current habit state before updating (to compare if recalculation is needed)
    const oldHabit = await queryOne<{ type: string; target_value: number | null }>(
      'SELECT type, target_value FROM habits WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [id, auth.userId]
    );

    if (!oldHabit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const habit = await queryOne(
      `UPDATE habits SET name = COALESCE($1, name), type = COALESCE($2, type),
       target_value = COALESCE($3, target_value), sort_order = COALESCE($4, sort_order)
       WHERE id = $5 AND user_id = $6 AND archived_at IS NULL
       RETURNING id, name, type, target_value, sort_order, to_char(created_at, 'YYYY-MM-DD') as created_at`,
      [name, type, target_value, sort_order, id, auth.userId]
    );

    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Recalculate completion status for count-based habits when target_value changes
    // Only if: (1) was and still is a count habit, (2) target_value provided, (3) actually changed
    const shouldRecalculate =
      oldHabit.type === 'count' &&
      habit.type === 'count' &&
      target_value !== undefined &&
      target_value !== null &&
      target_value !== oldHabit.target_value;

    if (shouldRecalculate) {
      await query(
        `UPDATE habit_completions
         SET completed = (value >= $1)
         WHERE habit_id = $2`,
        [target_value, id]
      );
    }

    return NextResponse.json(habit);
  } catch (error) {
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
