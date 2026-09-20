import { newId, nowIso } from '../client';
import { allRows, deleteRow, insertRow, updateRow, whereRows } from '../helpers';
import type { Meeting, Project, Task } from '../types';

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

// ---------- Tasks ----------
export const listTasks = () => allRows<Task>('tasks', 'sort_order ASC, created_at DESC');
export const listTasksByStatus = (status: Task['status']) =>
  whereRows<Task>('tasks', 'status = ?', [status], 'sort_order ASC, created_at DESC');
export const listTasksForProject = (projectId: string) =>
  whereRows<Task>('tasks', 'project_id = ?', [projectId], 'sort_order ASC');

export async function createTask(
  input: Omit<Task, 'id' | 'created_at' | 'completed_at'> & { completed_at?: string | null }
) {
  const id = newId();
  await insertRow('tasks', {
    id,
    ...input,
    completed_at: input.completed_at ?? null,
    created_at: nowIso(),
  });
  return id;
}

export const updateTask = (id: string, patch: Partial<Task>) => updateRow('tasks', id, patch);
export const deleteTask = (id: string) => deleteRow('tasks', id);

export async function toggleTaskDone(id: string, isDone: boolean) {
  await updateTask(id, {
    status: isDone ? 'done' : 'todo',
    completed_at: isDone ? nowIso() : null,
  });
}

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
