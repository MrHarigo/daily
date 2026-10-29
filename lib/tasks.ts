export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_RETURNING_COLS = `id, title, status,
  to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at`;

export interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  created_at: string;
}

export function isValidStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}
