import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const RETURNING_COLS = `id, user_id, title, emoji,
       to_char(target_date, 'YYYY-MM-DD') as target_date,
       color, note,
       to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at`;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, emoji, target_date, color, note } = body;

    const event = await queryOne(
      `UPDATE events SET
         title       = COALESCE($1, title),
         emoji       = COALESCE($2, emoji),
         target_date = COALESCE($3::date, target_date),
         color       = COALESCE($4, color),
         note        = $5
       WHERE id = $6 AND user_id = $7
       RETURNING ${RETURNING_COLS}`,
      [
        title?.trim() ?? null,
        emoji ?? null,
        target_date ?? null,
        color ?? null,
        note?.trim() || null,
        id,
        auth.userId,
      ]
    );

    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(event);
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;

    const event = await queryOne<{ id: string }>(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [id, auth.userId]
    );
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await query('DELETE FROM events WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
