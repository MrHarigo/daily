import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import {
  EVENT_RETURNING_COLS,
  MAX_TITLE_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_EMOJI_LENGTH,
  UUID_REGEX,
  isValidColor,
  isValidDateString,
} from '@/lib/events';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const { title, emoji, target_date, color, note } = body;

    if (title !== undefined && title !== null && title.trim().length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` }, { status: 400 });
    }
    // An explicit empty/invalid target_date would fail the ::date cast; a
    // null/undefined is fine (COALESCE keeps the existing value).
    if (target_date !== undefined && target_date !== null && !isValidDateString(target_date)) {
      return NextResponse.json({ error: 'Invalid target date' }, { status: 400 });
    }
    if (color && !isValidColor(color)) {
      return NextResponse.json({ error: 'Invalid color' }, { status: 400 });
    }
    if (emoji && [...emoji].length > MAX_EMOJI_LENGTH) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 });
    }
    if (note && note.trim().length > MAX_NOTE_LENGTH) {
      return NextResponse.json({ error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` }, { status: 400 });
    }

    const event = await queryOne(
      `UPDATE events SET
         title       = COALESCE($1, title),
         emoji       = COALESCE($2, emoji),
         target_date = COALESCE($3::date, target_date),
         color       = COALESCE($4, color),
         note        = $5
       WHERE id = $6 AND user_id = $7
       RETURNING ${EVENT_RETURNING_COLS}`,
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
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const deleted = await queryOne<{ id: string }>(
      'DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, auth.userId]
    );
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
