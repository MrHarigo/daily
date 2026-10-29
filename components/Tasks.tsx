'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TASK_STATUSES, TaskRow, TaskStatus } from '@/lib/tasks';

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const DISPLAY_ORDER: TaskStatus[] = ['in_progress', 'todo', 'backlog', 'done'];

export function Tasks() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    api.get<TaskRow[]>('/tasks')
      .then(setTasks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    setError(null);
    try {
      const created = await api.post<TaskRow>('/tasks', { title });
      setTasks((prev) => [...prev, created]);
    } catch (e) {
      setNewTitle(title);
      setError((e as Error).message);
    }
  }

  // Optimistic: apply locally, roll back if the server rejects.
  async function moveTask(task: TaskRow, status: TaskStatus) {
    setError(null);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await api.put(`/tasks/${task.id}`, { status });
    } catch (e) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      setError((e as Error).message);
    }
  }

  async function deleteTask(task: TaskRow) {
    setError(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await api.delete(`/tasks/${task.id}`);
    } catch (e) {
      setTasks((prev) => [...prev, task].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      setError((e as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dev Tasks</h1>

      <form onSubmit={addTask} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task…"
          aria-label="New task title"
          maxLength={255}
          className="input flex-1"
        />
        <button type="submit" disabled={!newTitle.trim()} className="btn btn-primary">Add</button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="space-y-4">
        {DISPLAY_ORDER.map((status) => {
          const sectionTasks = tasks.filter((t) => t.status === status);
          // Move buttons follow the workflow order, not the display order
          const step = TASK_STATUSES.indexOf(status);
          const prev = TASK_STATUSES[step - 1];
          const next = TASK_STATUSES[step + 1];
          return (
            <section key={status} className="card space-y-3" data-testid={`tasks-${status}`}>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                {STATUS_LABELS[status]} ({sectionTasks.length})
              </h2>
              {sectionTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg bg-surface-700 p-3">
                  <p className={`flex-1 min-w-0 text-sm break-words ${status === 'done' ? 'text-gray-500 line-through' : ''}`}>{task.title}</p>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                    {prev && (
                      <button onClick={() => moveTask(task, prev)} aria-label={`Move to ${STATUS_LABELS[prev]}`}
                        className="btn-ghost-plain px-2 rounded hover:text-gray-200">← {STATUS_LABELS[prev]}</button>
                    )}
                    {next && (
                      <button onClick={() => moveTask(task, next)} aria-label={`Move to ${STATUS_LABELS[next]}`}
                        className="btn-ghost-plain px-2 rounded hover:text-gray-200">{STATUS_LABELS[next]} →</button>
                    )}
                    <button onClick={() => deleteTask(task)} aria-label="Delete task" title="Delete task"
                      className="btn-ghost-plain px-2 rounded hover:text-danger">×</button>
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
