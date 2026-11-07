import { create } from 'zustand';
import * as repo from '../db/repositories/personal';
import type { PersonalKind } from '../db/repositories/personal';
import type { Gameya } from '../utils/gameya';
import type { Gift } from '../utils/gifts';
import type { EidiyaPerson } from '../utils/eidiya';
import type { PaydayStep } from '../utils/payday';
import type { Holding } from '../utils/wealth';

// The personal lists: gam'eyas, gifts given and received, Eidiya and the
// payday checklist. Loaded once, on first use.
export type Item<T> = T & { id: string; created_at: string };

interface DataByKind {
  gameya: Gameya;
  gift: Gift;
  eidiya: EidiyaPerson;
  payday_step: PaydayStep;
  holding: Holding;
}

interface PersonalState {
  loaded: boolean;
  gameya: Item<Gameya>[];
  gift: Item<Gift>[];
  eidiya: Item<EidiyaPerson>[];
  payday_step: Item<PaydayStep>[];
  holding: Item<Holding>[];
  hydrate: () => Promise<void>;
  add: <K extends PersonalKind>(kind: K, data: DataByKind[K]) => Promise<string>;
  update: <K extends PersonalKind>(kind: K, id: string, data: DataByKind[K]) => Promise<void>;
  remove: (kind: PersonalKind, id: string) => Promise<void>;
}

const KINDS: PersonalKind[] = ['gameya', 'gift', 'eidiya', 'payday_step', 'holding'];

export const usePersonalStore = create<PersonalState>((set, get) => ({
  loaded: false,
  gameya: [],
  gift: [],
  eidiya: [],
  payday_step: [],
  holding: [],
  hydrate: async () => {
    const rows = await repo.listPersonalRows();
    const next: Record<string, unknown[]> = Object.fromEntries(KINDS.map((k) => [k, []]));
    for (const r of rows) {
      if (!next[r.kind]) continue;
      try {
        next[r.kind].push({ ...JSON.parse(r.data), id: r.id, created_at: r.created_at });
      } catch {
        // A damaged row is skipped rather than breaking the list.
      }
    }
    set({ ...(next as Partial<PersonalState>), loaded: true });
  },
  add: async (kind, data) => {
    const id = await repo.createPersonalRow(kind, data);
    await get().hydrate();
    return id;
  },
  update: async (_kind, id, data) => {
    const { id: _id, created_at: _c, ...rest } = data as unknown as Record<string, unknown>;
    await repo.updatePersonalRow(id, rest);
    await get().hydrate();
  },
  remove: async (_kind, id) => {
    await repo.deletePersonalRow(id);
    await get().hydrate();
  },
}));

// Loads the lists the first time a screen needs them.
export function ensurePersonalLoaded(): void {
  if (!usePersonalStore.getState().loaded) usePersonalStore.getState().hydrate().catch(() => {});
}
