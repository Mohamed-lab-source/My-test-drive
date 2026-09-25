import { create } from 'zustand';
import type { Meeting, Project, Task } from '../db/types';
import * as repo from '../db/repositories/productivity';
import { todayKey } from '../db/client';
import { refreshTasksWidget } from '../widgets/refresh';
import { cancelMeetingReminder, scheduleMeetingReminder } from '../notifications/scheduler';

interface ProductivityState {
  loaded: boolean;
  projects: Project[];
  tasks: Task[];
  meetings: Meeting[];

  hydrate: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshMeetings: () => Promise<void>;

  addTask: (input: Parameters<typeof repo.createTask>[0]) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  toggleTaskDone: (id: string, isDone: boolean) => Promise<void>;
  removeTask: (id: string) => Promise<void>;

  addProject: (input: Parameters<typeof repo.createProject>[0]) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  moveProject: (id: string, direction: 'up' | 'down') => Promise<void>;
  moveTask: (id: string, direction: 'up' | 'down') => Promise<void>;

  addMeeting: (input: Parameters<typeof repo.createMeeting>[0]) => Promise<void>;
  updateMeeting: (id: string, patch: Partial<Meeting>) => Promise<void>;
  removeMeeting: (id: string) => Promise<void>;
}

export const useProductivityStore = create<ProductivityState>((set, get) => ({
  loaded: false,
  projects: [],
  tasks: [],
  meetings: [],

  hydrate: async () => {
    await repo.rolloverStaleTasks(todayKey());
    const [projects, tasks, meetings] = await Promise.all([
      repo.listProjects(),
      repo.listTasks(),
      repo.listMeetings(),
    ]);
    set({ projects, tasks, meetings, loaded: true });
  },
  refreshTasks: async () => {
    set({ tasks: await repo.listTasks() });
    refreshTasksWidget();
  },
  refreshProjects: async () => set({ projects: await repo.listProjects() }),
  refreshMeetings: async () => set({ meetings: await repo.listMeetings() }),

  addTask: async (input) => {
    await repo.createTask(input);
    await get().refreshTasks();
  },
  updateTask: async (id, patch) => {
    await repo.updateTask(id, patch);
    await get().refreshTasks();
  },
  toggleTaskDone: async (id, isDone) => {
    await repo.toggleTaskDone(id, isDone);
    await get().refreshTasks();
  },
  removeTask: async (id) => {
    await repo.deleteTask(id);
    await get().refreshTasks();
  },

  addProject: async (input) => {
    await repo.createProject(input);
    await get().refreshProjects();
  },
  removeProject: async (id) => {
    await repo.deleteProject(id);
    await get().refreshProjects();
  },
  moveProject: async (id, direction) => {
    const projects = get().projects;
    const index = projects.findIndex((p) => p.id === id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= projects.length) return;
    await repo.reorderProjects(projects[index], projects[swapIndex]);
    await get().refreshProjects();
  },
  moveTask: async (id, direction) => {
    const tasks = get().tasks;
    const index = tasks.findIndex((t) => t.id === id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= tasks.length) return;
    await repo.reorderTasks(tasks[index], tasks[swapIndex]);
    await get().refreshTasks();
  },

  addMeeting: async (input) => {
    const id = await repo.createMeeting(input);
    await get().refreshMeetings();
    const meeting = get().meetings.find((m) => m.id === id);
    if (meeting) scheduleMeetingReminder(meeting);
  },
  updateMeeting: async (id, patch) => {
    await repo.updateMeeting(id, patch);
    await get().refreshMeetings();
    const meeting = get().meetings.find((m) => m.id === id);
    if (meeting) scheduleMeetingReminder(meeting);
  },
  removeMeeting: async (id) => {
    await repo.deleteMeeting(id);
    await cancelMeetingReminder(id);
    await get().refreshMeetings();
  },
}));
