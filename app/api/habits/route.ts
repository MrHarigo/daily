import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';

    const habits = await query(
      `SELECT id, name, type, target_value, sort_order, scheduled_days,
              to_char(created_at, 'YYYY-MM-DD') as created_at,
              to_char(paused_at, 'YYYY-MM-DD"T"HH24:MI:SS') as paused_at,
              to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS') as archived_at
       FROM habits
       WHERE user_id = $1
       ${includeAll ? '' : 'AND archived_at IS NULL'}
       ORDER BY sort_order, created_at`,
      [auth.userId]
    );
    return NextResponse.json(habits);
  } catch (error) {
    console.error('Get habits error:', error);
    return NextResponse.json({ error: 'Failed to get habits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { name, type = 'boolean', target_value } = body;
    let { scheduled_days } = body;
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    // Validate scheduled_days
    if (scheduled_days !== undefined && scheduled_days !== null) {
      if (!Array.isArray(scheduled_days)) {
        return NextResponse.json({ error: 'scheduled_days must be an array' }, { status: 400 });
      }
      if (scheduled_days.length === 0) {
        return NextResponse.json({ error: 'At least one day must be selected' }, { status: 400 });
      }
      // Ensure only weekdays (1-5)
      if (!scheduled_days.every(d => Number.isInteger(d) && d >= 1 && d <= 5)) {
        return NextResponse.json({ error: 'scheduled_days must contain only weekdays (1-5)' }, { status: 400 });
      }
      // Remove duplicates and sort
      scheduled_days = [...new Set(scheduled_days)].sort();
    }

    const maxOrder = await queryOne<{ max: number }>(
      'SELECT COALESCE(MAX(sort_order), 0) as max FROM habits WHERE user_id = $1 AND archived_at IS NULL',
      [auth.userId]
    );

    const habit = await queryOne(
      `INSERT INTO habits (user_id, name, type, target_value, sort_order, scheduled_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, type, target_value, sort_order, scheduled_days,
                 to_char(created_at, 'YYYY-MM-DD') as created_at,
                 paused_at, archived_at`,
      [auth.userId, name, type, target_value, (maxOrder?.max || 0) + 1, scheduled_days || null]
    );
    return NextResponse.json(habit);
  } catch (error) {
    console.error('Create habit error:', error);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}
