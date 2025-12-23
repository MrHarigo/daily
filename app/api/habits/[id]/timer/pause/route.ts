import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
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

    const current = await queryOne<{ started_at: string }>(
      'SELECT started_at FROM active_timers WHERE habit_id = $1 AND is_running = TRUE',
      [id]
    );
    
    if (current) {
      const elapsed = Math.floor((Date.now() - new Date(current.started_at).getTime()) / 1000);
      await query(
        'UPDATE active_timers SET is_running = FALSE, accumulated_seconds = accumulated_seconds + $1 WHERE habit_id = $2',
        [elapsed, id]
      );
    }
    
    const timer = await queryOne(
      `SELECT habit_id, to_char(date, 'YYYY-MM-DD') as date, started_at, accumulated_seconds, is_running 
       FROM active_timers WHERE habit_id = $1`,
      [id]
    );
    return NextResponse.json(timer);
  } catch (err) {
    console.error('Timer pause error:', err);
    return NextResponse.json({ error: 'Failed to pause timer' }, { status: 500 });
  }
}
