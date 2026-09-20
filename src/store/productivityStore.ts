import { create } from 'zustand';
import type { Meeting, Project, Task } from '../db/types';
import * as repo from '../db/repositories/productivity';
import { refreshTasksWidget } from '../widgets/refresh';

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

  addMeeting: async (input) => {
    await repo.createMeeting(input);
    await get().refreshMeetings();
  },
  updateMeeting: async (id, patch) => {
    await repo.updateMeeting(id, patch);
    await get().refreshMeetings();
  },
  removeMeeting: async (id) => {
    await repo.deleteMeeting(id);
    await get().refreshMeetings();
  },
}));
