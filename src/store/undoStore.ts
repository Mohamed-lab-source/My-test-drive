import { create } from 'zustand';

interface UndoState {
  message: string | null;
  onUndo: (() => void) | null;
  // Without onUndo it's a plain confirmation (shown for less time).
  show: (message: string, onUndo?: () => void) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useUndoStore = create<UndoState>((set) => ({
  message: null,
  onUndo: null,
  show: (message, onUndo) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, onUndo: onUndo ?? null });
    hideTimer = setTimeout(() => set({ message: null, onUndo: null }), onUndo ? 5000 : 2200);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null, onUndo: null });
  },
}));
