import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { MAX_TITLE_LENGTH, UUID_REGEX } from '@/lib/events';
import { TASK_RETURNING_COLS, isValidStatus } from '@/lib/tasks';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { title, status } = await request.json();

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }
    if (title !== undefined && title.trim().length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` }, { status: 400 });
    }
    if (status !== undefined && !isValidStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const task = await queryOne(
      `UPDATE dev_tasks SET
         title  = COALESCE($1, title),
         status = COALESCE($2, status)
       WHERE id = $3 AND user_id = $4
       RETURNING ${TASK_RETURNING_COLS}`,
      [title?.trim() ?? null, status ?? null, id, auth.userId]
    );

    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    console.error('Update task error:', error);
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
      'DELETE FROM dev_tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, auth.userId]
    );
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
