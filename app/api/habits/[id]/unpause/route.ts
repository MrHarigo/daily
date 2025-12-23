import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  
  try {
    const habit = await queryOne(
      `UPDATE habits SET paused_at = NULL WHERE id = $1 AND user_id = $2 AND archived_at IS NULL AND paused_at IS NOT NULL
       RETURNING id, name, type, target_value, sort_order, to_char(created_at, 'YYYY-MM-DD') as created_at, paused_at`,
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(habit);
  } catch (err) {
    console.error('Unpause habit error:', err);
    return NextResponse.json({ error: 'Failed to unpause habit' }, { status: 500 });
  }
}
