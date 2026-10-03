import { create } from 'zustand';

interface UndoState {
  message: string | null;
  onUndo: (() => void) | null;
  show: (message: string, onUndo: () => void) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useUndoStore = create<UndoState>((set) => ({
  message: null,
  onUndo: null,
  show: (message, onUndo) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, onUndo });
    hideTimer = setTimeout(() => set({ message: null, onUndo: null }), 5000);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null, onUndo: null });
  },
}));
