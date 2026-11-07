// Routines marked "every morning" add their items to Today the first time
// Anchor opens each day.
import { useSettingsStore } from '../store/settingsStore';
import { useProductivityStore } from '../store/productivityStore';
import * as repo from '../db/repositories/lists';
import { todayKey } from '../db/client';

let running: Promise<number> | null = null;

// Launch and "app came back" can both fire at once; run one at a time.
export function applyAutoRoutines(): Promise<number> {
  if (!running) running = run().finally(() => (running = null));
  return running;
}

async function run(): Promise<number> {
  const { autoRoutines, setAutoRoutines } = useSettingsStore.getState();
  const today = todayKey();
  const due = Object.entries(autoRoutines).filter(([, last]) => last !== today);
  if (!due.length) return 0;
  const routines = await repo.listRoutines();
  const { addTask, tasks } = useProductivityStore.getState();
  const next = { ...autoRoutines };
  let added = 0;
  let order = Date.now();
  for (const [id] of due) {
    const r = routines.find((x) => x.id === id);
    if (!r) {
      delete next[id];
      continue;
    }
    for (const title of repo.routineItems(r)) {
      // Don't double up if it's already on today's list.
      if (tasks.some((t) => t.title === title && t.scheduled_date === today && t.status !== 'done')) continue;
      await addTask({ project_id: null, title, notes: null, status: 'todo', priority: 'medium', due_date: null, scheduled_date: today, sort_order: order++ });
      added++;
    }
    next[id] = today;
  }
  setAutoRoutines(next);
  return added;
}
