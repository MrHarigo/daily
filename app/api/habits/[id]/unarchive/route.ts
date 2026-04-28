import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { HABIT_RETURNING_COLS } from '@/lib/habits';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const habit = await queryOne(
      `UPDATE habits SET archived_at = NULL WHERE id = $1 AND user_id = $2 AND archived_at IS NOT NULL
       RETURNING ${HABIT_RETURNING_COLS}`,
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(habit);
  } catch (error) {
    console.error('Unarchive habit error:', error);
    return NextResponse.json({ error: 'Failed to unarchive habit' }, { status: 500 });
  }
}
