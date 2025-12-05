import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    const timer = await queryOne(
      `SELECT habit_id, to_char(date, 'YYYY-MM-DD') as date, started_at, accumulated_seconds, is_running
       FROM active_timers WHERE habit_id = $1`, [id]
    );
    return NextResponse.json(timer);
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

