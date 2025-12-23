import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  
  try {
    // Verify ownership
    const habit = await queryOne<{ id: string }>(
      'SELECT id FROM habits WHERE id = $1 AND user_id = $2',
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { date } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });
    
    const existing = await queryOne('SELECT * FROM active_timers WHERE habit_id = $1', [id]);
    let timer;
    
    if (existing) {
      timer = await queryOne(
        `UPDATE active_timers SET is_running = TRUE, started_at = NOW(), date = $2 WHERE habit_id = $1
         RETURNING habit_id, to_char(date, 'YYYY-MM-DD') as date, started_at, accumulated_seconds, is_running`,
        [id, date]
      );
    } else {
      const existingCompletion = await queryOne<{ value: number }>(
        'SELECT value FROM habit_completions WHERE habit_id = $1 AND date = $2',
        [id, date]
      );
      timer = await queryOne(
        `INSERT INTO active_timers (habit_id, date, started_at, accumulated_seconds, is_running) VALUES ($1, $2, NOW(), $3, TRUE)
         RETURNING habit_id, to_char(date, 'YYYY-MM-DD') as date, started_at, accumulated_seconds, is_running`,
        [id, date, existingCompletion?.value || 0]
      );
    }
    return NextResponse.json(timer);
  } catch (err) {
    console.error('Timer start error:', err);
    return NextResponse.json({ error: 'Failed to start timer' }, { status: 500 });
  }
}
