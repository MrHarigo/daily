import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  
  try {
    // Only get timers for habits owned by the user
    const timers = await query(
      `SELECT at.habit_id, to_char(at.date, 'YYYY-MM-DD') as date, at.started_at, at.accumulated_seconds, at.is_running 
       FROM active_timers at
       INNER JOIN habits h ON at.habit_id = h.id
       WHERE h.user_id = $1`,
      [auth.userId]
    );
    return NextResponse.json(timers);
  } catch (error) {
    console.error('Fetch timers error:', error);
    return NextResponse.json({ error: 'Failed to fetch timers' }, { status: 500 });
  }
}
