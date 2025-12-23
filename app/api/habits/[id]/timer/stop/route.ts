import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  
  try {
    // Verify ownership and get target_value
    const habit = await queryOne<{ target_value: number }>(
      'SELECT target_value FROM habits WHERE id = $1 AND user_id = $2',
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const timer = await queryOne<{ date: string; started_at: string; accumulated_seconds: number; is_running: boolean }>(
      'SELECT * FROM active_timers WHERE habit_id = $1',
      [id]
    );
    if (!timer) return NextResponse.json({ error: 'No timer found' }, { status: 400 });
    
    let totalSeconds = timer.accumulated_seconds;
    if (timer.is_running) {
      totalSeconds += Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000);
    }
    
    const targetSeconds = (habit?.target_value || 0) * 60;
    const completed = totalSeconds >= targetSeconds;
    
    const completion = await queryOne(
      `INSERT INTO habit_completions (habit_id, date, value, completed) VALUES ($1, $2, $3, $4)
       ON CONFLICT (habit_id, date) DO UPDATE SET value = $3, completed = $3 >= $5
       RETURNING id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed`,
      [id, timer.date, totalSeconds, completed, targetSeconds]
    );
    
    await query('DELETE FROM active_timers WHERE habit_id = $1', [id]);
    return NextResponse.json({ completion, totalSeconds });
  } catch (err) {
    console.error('Timer stop error:', err);
    return NextResponse.json({ error: 'Failed to stop timer' }, { status: 500 });
  }
}
