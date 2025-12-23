import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  
  try {
    const dayoffs = await query(
      `SELECT to_char(date, 'YYYY-MM-DD') as date, reason FROM day_offs WHERE user_id = $1`,
      [auth.userId]
    );
    return NextResponse.json(dayoffs);
  } catch (err) {
    console.error('Fetch day-offs error:', err);
    return NextResponse.json({ error: 'Failed to fetch day-offs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { date, reason } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    const dayoff = await queryOne(
      `INSERT INTO day_offs (user_id, date, reason) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date) DO UPDATE SET reason = $3
       RETURNING to_char(date, 'YYYY-MM-DD') as date, reason`,
      [auth.userId, date, reason || null]
    );
    return NextResponse.json(dayoff);
  } catch (err) {
    console.error('Add day-off error:', err);
    return NextResponse.json({ error: 'Failed to add day-off' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    await query('DELETE FROM day_offs WHERE user_id = $1 AND date = $2', [auth.userId, date]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete day-off error:', err);
    return NextResponse.json({ error: 'Failed to delete day-off' }, { status: 500 });
  }
}
