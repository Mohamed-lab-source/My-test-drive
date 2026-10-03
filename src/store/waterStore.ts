import { create } from 'zustand';
import * as health from '../db/repositories/health';
import { todayKey } from '../db/client';

// Today's glasses, shared by the Home water card and progress rings.
interface WaterState {
  count: number;
  load: () => Promise<void>;
  add: (delta: number) => Promise<number>;
}

export const useWaterStore = create<WaterState>((set, get) => ({
  count: 0,
  load: async () => set({ count: await health.getWater(todayKey()) }),
  add: async (delta) => {
    const next = Math.max(0, get().count + delta);
    await health.setWater(todayKey(), next);
    set({ count: next });
    return next;
  },
}));
