import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  try {
    const habit = await queryOne(
      `UPDATE habits SET archived_at = NULL WHERE id = $1 AND user_id = $2
       RETURNING id, name, type, target_value, sort_order, to_char(created_at, 'YYYY-MM-DD') as created_at,
       paused_at, archived_at, scheduled_days, streak_frozen_at, frozen_streak`,
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(habit);
  } catch (error) {
    console.error('Unarchive habit error:', error);
    return NextResponse.json({ error: 'Failed to unarchive habit' }, { status: 500 });
  }
}
