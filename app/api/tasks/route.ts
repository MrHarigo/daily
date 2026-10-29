import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { MAX_TITLE_LENGTH } from '@/lib/events';
import { TASK_RETURNING_COLS, isValidStatus } from '@/lib/tasks';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const tasks = await query(
      `SELECT ${TASK_RETURNING_COLS}
       FROM dev_tasks
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [auth.userId]
    );
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json({ error: 'Failed to get tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { title, status } = await request.json();

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` }, { status: 400 });
    }
    if (status !== undefined && !isValidStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const task = await queryOne(
      `INSERT INTO dev_tasks (user_id, title, status)
       VALUES ($1, $2, $3)
       RETURNING ${TASK_RETURNING_COLS}`,
      [auth.userId, title.trim(), status ?? 'backlog']
    );
    return NextResponse.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
