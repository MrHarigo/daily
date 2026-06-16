import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const RETURNING_COLS = `id, user_id, title, emoji,
       to_char(target_date, 'YYYY-MM-DD') as target_date,
       color, note,
       to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at`;

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const events = await query(
      `SELECT ${RETURNING_COLS}
       FROM events
       WHERE user_id = $1
       ORDER BY target_date ASC`,
      [auth.userId]
    );
    return NextResponse.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ error: 'Failed to get events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { title, emoji, target_date, color, note } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }
    if (!target_date) {
      return NextResponse.json({ error: 'Target date required' }, { status: 400 });
    }

    const event = await queryOne(
      `INSERT INTO events (user_id, title, emoji, target_date, color, note)
       VALUES ($1, $2, $3, $4::date, $5, $6)
       RETURNING ${RETURNING_COLS}`,
      [
        auth.userId,
        title.trim(),
        emoji || '🎯',
        target_date,
        color || 'violet',
        note?.trim() || null,
      ]
    );
    return NextResponse.json(event);
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
