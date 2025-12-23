import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const result = await queryOne(
      'UPDATE habits SET archived_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, auth.userId]
    );
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unarchive error:', err);
    return NextResponse.json({ error: 'Failed to unarchive' }, { status: 500 });
  }
}
