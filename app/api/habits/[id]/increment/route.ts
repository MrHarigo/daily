import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
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

    const { date, delta = 1 } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });
    
    const completion = await queryOne(
      `INSERT INTO habit_completions (habit_id, date, value, completed) VALUES ($1, $2, GREATEST(0, $3), $3 >= $4)
       ON CONFLICT (habit_id, date) DO UPDATE SET value = GREATEST(0, habit_completions.value + $3),
       completed = GREATEST(0, habit_completions.value + $3) >= $4
       RETURNING id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed`,
      [id, date, delta, habit?.target_value || 1]
    );
    return NextResponse.json(completion);
  } catch (err) {
    console.error('Increment error:', err);
    return NextResponse.json({ error: 'Failed to increment habit' }, { status: 500 });
  }
}
