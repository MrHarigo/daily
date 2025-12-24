import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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

    const habit = await queryOne(
      `UPDATE habits SET name = COALESCE($1, name), type = COALESCE($2, type),
       target_value = COALESCE($3, target_value), sort_order = COALESCE($4, sort_order),
       scheduled_days = COALESCE($5, scheduled_days)
       WHERE id = $6 AND user_id = $7 AND archived_at IS NULL
       RETURNING id, name, type, target_value, sort_order, scheduled_days,
                 to_char(created_at, 'YYYY-MM-DD') as created_at`,
      [name, type, target_value, sort_order, scheduled_days, id, auth.userId]
    );

    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
