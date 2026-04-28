import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { HABIT_RETURNING_COLS, HabitRow } from '@/lib/habits';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const habit = await queryOne<HabitRow>(
      `UPDATE habits SET archived_at = NOW() WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
       RETURNING ${HABIT_RETURNING_COLS}`,
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(habit);
  } catch (error) {
    console.error('Failed to archive habit:', error);
    return NextResponse.json({ error: 'Failed to archive habit' }, { status: 500 });
  }
}
