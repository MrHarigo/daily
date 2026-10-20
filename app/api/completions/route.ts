import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (!startDate || !endDate) return NextResponse.json({ error: 'Dates required' }, { status: 400 });
    const completions = await query(
      `SELECT hc.id, hc.habit_id, to_char(hc.date, 'YYYY-MM-DD') as date, hc.value, hc.completed
       FROM habit_completions hc
       INNER JOIN habits h ON hc.habit_id = h.id
       WHERE h.user_id = $3 AND hc.date >= $1 AND hc.date <= $2`,
      [startDate, endDate, auth.userId]
    );
    return NextResponse.json(completions);
  } catch (error) {
    console.error('Fetch completions error:', error);
    return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 });
  }
}

