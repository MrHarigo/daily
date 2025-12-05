import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  try {
    const timers = await query(
      `SELECT habit_id, to_char(date, 'YYYY-MM-DD') as date, started_at, accumulated_seconds, is_running FROM active_timers`
    );
    return NextResponse.json(timers);
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

