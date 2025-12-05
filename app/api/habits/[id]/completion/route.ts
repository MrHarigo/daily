import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    const { date, value, completed } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });
    const completion = await queryOne(
      `INSERT INTO habit_completions (habit_id, date, value, completed) VALUES ($1, $2, $3, $4)
       ON CONFLICT (habit_id, date) DO UPDATE SET value = $3, completed = $4
       RETURNING id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed`,
      [id, date, value ?? 0, completed ?? false]
    );
    return NextResponse.json(completion);
  } catch (error) {
    console.error('Completion error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

