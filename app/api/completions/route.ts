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
      `SELECT id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed
       FROM habit_completions WHERE date >= $1 AND date <= $2`,
      [startDate, endDate]
    );
    return NextResponse.json(completions);
  } catch (err) {
    console.error('Fetch completions error:', err);
    return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 });
  }
}

