import { newId, nowIso, todayKey } from '../client';
import { allRows, deleteRow, getRow, insertRow, swapSortOrder, updateRow, whereRows } from '../helpers';
import type { Meeting, Project, Subtask, Task } from '../types';

// scheduled_date is stored as a plain 'YYYY-MM-DD' key (see todayKey), not a
// full ISO timestamp, so the "Today" filter's string equality keeps working.
function advanceScheduledDate(
  dateKey: string,
  frequency: NonNullable<Task['repeat_frequency']>,
  interval: number
): string {
  const d = new Date(`${dateKey}T00:00:00`);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + interval);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7 * interval);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + interval);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + interval);
      break;
  }
  return todayKey(d);
}

// ---------- Projects ----------
export const listProjects = () => allRows<Project>('projects', 'sort_order ASC');

export async function createProject(input: Omit<Project, 'id' | 'is_archived'>) {
  const id = newId();
  await insertRow('projects', { id, ...input, is_archived: 0 });
  return id;
}
export const updateProject = (id: string, patch: Partial<Project>) =>
  updateRow('projects', id, patch);
export const deleteProject = (id: string) => deleteRow('projects', id);
export const reorderProjects = (a: Project, b: Project) => swapSortOrder('projects', a, b);

// ---------- Tasks ----------
export const listTasks = () => allRows<Task>('tasks', 'sort_order ASC, created_at DESC');
export const listTasksByStatus = (status: Task['status']) =>
  whereRows<Task>('tasks', 'status = ?', [status], 'sort_order ASC, created_at DESC');
export const listTasksForProject = (projectId: string) =>
  whereRows<Task>('tasks', 'project_id = ?', [projectId], 'sort_order ASC');

export async function createTask(
  input: Omit<Task, 'id' | 'created_at' | 'completed_at' | 'repeat_frequency' | 'repeat_interval'> & {
    completed_at?: string | null;
    repeat_frequency?: Task['repeat_frequency'];
    repeat_interval?: number | null;
  }
) {
  const id = newId();
  await insertRow('tasks', {
    id,
    ...input,
    completed_at: input.completed_at ?? null,
    repeat_frequency: input.repeat_frequency ?? null,
    repeat_interval: input.repeat_interval ?? null,
    created_at: nowIso(),
  });
  return id;
}

export const updateTask = (id: string, patch: Partial<Task>) => updateRow('tasks', id, patch);
export const deleteTask = (id: string) => deleteRow('tasks', id);
export const reorderTasks = (a: Task, b: Task) => swapSortOrder('tasks', a, b);

export async function toggleTaskDone(id: string, isDone: boolean) {
  const task = await getRow<Task>('tasks', id);
  await updateTask(id, {
    status: isDone ? 'done' : 'todo',
    completed_at: isDone ? nowIso() : null,
  });

  if (isDone && task?.repeat_frequency) {
    const nextDate = advanceScheduledDate(
      task.scheduled_date ?? todayKey(),
      task.repeat_frequency,
      task.repeat_interval ?? 1
    );
    await createTask({
      project_id: task.project_id,
      title: task.title,
      notes: task.notes,
      status: 'todo',
      priority: task.priority,
      due_date: null,
      scheduled_date: nextDate,
      sort_order: task.sort_order,
      repeat_frequency: task.repeat_frequency,
      repeat_interval: task.repeat_interval,
    });
  }
}

// A task scheduled for a past day that's still open (not done, not already
// backlog) missed its day — send it to the backlog instead of leaving it
// stuck showing as "today" forever.
export async function rolloverStaleTasks(todayStr: string): Promise<void> {
  const stale = await whereRows<Task>(
    'tasks',
    "status IN ('todo', 'in_progress') AND scheduled_date IS NOT NULL AND scheduled_date < ?",
    [todayStr]
  );
  for (const task of stale) {
    await updateTask(task.id, { status: 'backlog' });
  }
}

// ---------- Subtasks ----------
export const listSubtasks = (taskId: string) =>
  whereRows<Subtask>('subtasks', 'task_id = ?', [taskId], 'sort_order ASC');

export async function createSubtask(taskId: string, title: string): Promise<string> {
  const id = newId();
  const existing = await listSubtasks(taskId);
  await insertRow('subtasks', { id, task_id: taskId, title, is_done: 0, sort_order: existing.length });
  return id;
}
export const toggleSubtaskDone = (id: string, isDone: boolean) =>
  updateRow('subtasks', id, { is_done: isDone ? 1 : 0 });
export const deleteSubtask = (id: string) => deleteRow('subtasks', id);

// ---------- Meetings ----------
export const listMeetings = () => allRows<Meeting>('meetings', 'start_at ASC');
export const listUpcomingMeetings = (fromIso: string) =>
  whereRows<Meeting>('meetings', 'start_at >= ?', [fromIso], 'start_at ASC');

export async function createMeeting(input: Omit<Meeting, 'id' | 'created_at'>) {
  const id = newId();
  await insertRow('meetings', { id, ...input, created_at: nowIso() });
  return id;
}
export const updateMeeting = (id: string, patch: Partial<Meeting>) =>
  updateRow('meetings', id, patch);
export const deleteMeeting = (id: string) => deleteRow('meetings', id);
