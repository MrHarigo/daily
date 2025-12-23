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
      `SELECT id, name, type, target_value, sort_order, 
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
  } catch (err) {
    console.error('Get habits error:', err);
    return NextResponse.json({ error: 'Failed to get habits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { name, type = 'boolean', target_value } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const maxOrder = await queryOne<{ max: number }>(
      'SELECT COALESCE(MAX(sort_order), 0) as max FROM habits WHERE user_id = $1 AND archived_at IS NULL',
      [auth.userId]
    );

    const habit = await queryOne(
      `INSERT INTO habits (user_id, name, type, target_value, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, type, target_value, sort_order, 
                 to_char(created_at, 'YYYY-MM-DD') as created_at,
                 paused_at, archived_at`,
      [auth.userId, name, type, target_value, (maxOrder?.max || 0) + 1]
    );
    return NextResponse.json(habit);
  } catch (err) {
    console.error('Create habit error:', err);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}
