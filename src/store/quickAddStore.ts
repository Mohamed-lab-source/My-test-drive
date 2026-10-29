import { create } from 'zustand';

export type QuickSheet = 'expense' | 'income' | 'transfer' | 'task' | null;

interface QuickAddState {
  // Which global add sheet is open (rendered once, in the tabs layout).
  sheet: QuickSheet;
  // The account to start from, when opened from an account's menu.
  accountId: string | null;
  // Pre-filled transfer target and amount, e.g. "Pay this card".
  toAccountId: string | null;
  amount: number | null;
  open: (sheet: QuickSheet, accountId?: string, extra?: { toAccountId?: string; amount?: number }) => void;
  // The current screen's own "add" action, registered by its FAB, so the
  // tab bar's + button can do it in one tap.
  screenAction: { id: number; onPress: () => void; icon: string } | null;
  setScreenAction: (a: QuickAddState['screenAction']) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}

export const useQuickAddStore = create<QuickAddState>((set) => ({
  sheet: null,
  accountId: null,
  toAccountId: null,
  amount: null,
  open: (sheet, accountId, extra) =>
    set({ sheet, accountId: accountId ?? null, toAccountId: extra?.toAccountId ?? null, amount: extra?.amount ?? null, menuOpen: false }),
  screenAction: null,
  setScreenAction: (screenAction) => set({ screenAction }),
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
}));
