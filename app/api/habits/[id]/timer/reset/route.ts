import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  
  try {
    // Verify ownership
    const habit = await queryOne<{ id: string }>(
      'SELECT id FROM habits WHERE id = $1 AND user_id = $2',
      [id, auth.userId]
    );
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await query('DELETE FROM active_timers WHERE habit_id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Timer reset error:', error);
    return NextResponse.json({ error: 'Failed to reset timer' }, { status: 500 });
  }
}
