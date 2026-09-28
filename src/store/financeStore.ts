import { create } from 'zustand';
import type {
  Account,
  Budget,
  Category,
  NetWorthSnapshot,
  Debt,
  FxRate,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from '../db/types';
import * as repo from '../db/repositories/finance';
import * as fxRepo from '../db/repositories/fx';
import { seedDefaultsIfEmpty } from '../db/seed';
import { refreshMoneyWidget } from '../widgets/refresh';
import { cancelBillReminder, notifyNow, scheduleBillReminder } from '../notifications/scheduler';
import { settingsHydrated, useSettingsStore } from './settingsStore';
import { todayKey } from '../db/client';
import { formatMoney } from '../utils/money';

interface FinanceState {
  loaded: boolean;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  budgets: Budget[];
  fxRates: FxRate[];
  netWorthHistory: NetWorthSnapshot[];

  hydrate: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshRecurring: () => Promise<void>;
  refreshDebts: () => Promise<void>;
  refreshSavings: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshBudgets: () => Promise<void>;
  refreshFxRates: () => Promise<void>;
  recordNetWorthSnapshot: () => Promise<void>;

  addTransaction: (input: Parameters<typeof repo.createTransaction>[0]) => Promise<void>;
  updateTransaction: (id: string, patch: Parameters<typeof repo.updateTransaction>[1]) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  addAccount: (input: Parameters<typeof repo.createAccount>[0]) => Promise<void>;
  updateAccount: (id: string, patch: Partial<Account>) => Promise<void>;
  addCategory: (input: Parameters<typeof repo.createCategory>[0]) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  addRecurringRule: (input: Parameters<typeof repo.createRecurringRule>[0]) => Promise<void>;
  removeRecurringRule: (id: string) => Promise<void>;
  postRecurring: (rule: RecurringRule) => Promise<void>;
  skipRecurring: (rule: RecurringRule) => Promise<void>;
  setRecurringPaused: (id: string, paused: boolean) => Promise<void>;
  setRecurringAutoPost: (id: string, on: boolean) => Promise<void>;

  addDebt: (input: Parameters<typeof repo.createDebt>[0]) => Promise<void>;
  payDebt: (debtId: string, amount: number, note?: string) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;

  addSavingsGoal: (input: Parameters<typeof repo.createSavingsGoal>[0]) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number, note?: string) => Promise<void>;
  removeSavingsGoal: (id: string) => Promise<void>;

  setBudget: (categoryId: string, monthlyLimit: number, currency: string) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;

  setFxRate: (currency: string, rateToBase: number) => Promise<void>;
  removeFxRate: (currency: string) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  loaded: false,
  categories: [],
  accounts: [],
  transactions: [],
  recurringRules: [],
  debts: [],
  savingsGoals: [],
  budgets: [],
  fxRates: [],
  netWorthHistory: [],

  hydrate: async () => {
    const [categories, accounts] = await Promise.all([repo.listCategories(), repo.listAccounts()]);
    await seedDefaultsIfEmpty(categories.length, accounts.length);
    await repo.postDueAutoRules();
    const [cats2, accs2, transactions, recurringRules, debts, savingsGoals, budgets, fxRates] = await Promise.all([
      repo.listCategories(),
      repo.listAccounts(),
      repo.listTransactions(200),
      repo.listRecurringRules(),
      repo.listDebts(),
      repo.listSavingsGoals(),
      repo.listBudgets(),
      fxRepo.listFxRates(),
    ]);
    set({
      categories: cats2,
      accounts: accs2,
      transactions,
      recurringRules,
      debts,
      savingsGoals,
      budgets,
      fxRates,
      loaded: true,
    });
    await get().recordNetWorthSnapshot();
  },

  refreshTransactions: async () => set({ transactions: await repo.listTransactions(200) }),
  refreshAccounts: async () => {
    set({ accounts: await repo.listAccounts() });
    refreshMoneyWidget();
    await get().recordNetWorthSnapshot();
  },
  // One snapshot per local day, overwritten as balances change during it.
  recordNetWorthSnapshot: async () => {
    await settingsHydrated();
    const base = useSettingsStore.getState().currency;
    const { accounts, fxRates } = get();
    const total = accounts.reduce((sum, a) => sum + fxRepo.convertToBase(a.balance, a.currency, base, fxRates), 0);
    await repo.upsertNetWorthSnapshot(todayKey(), total, base);
    set({ netWorthHistory: await repo.listNetWorthSnapshots() });
  },
  refreshRecurring: async () => {
    set({ recurringRules: await repo.listRecurringRules() });
    refreshMoneyWidget();
  },
  refreshDebts: async () => set({ debts: await repo.listDebts() }),
  refreshSavings: async () => set({ savingsGoals: await repo.listSavingsGoals() }),
  refreshCategories: async () => set({ categories: await repo.listCategories() }),
  refreshBudgets: async () => set({ budgets: await repo.listBudgets() }),
  refreshFxRates: async () => set({ fxRates: await fxRepo.listFxRates() }),

  addTransaction: async (input) => {
    const budget =
      input.type === 'expense' && input.category_id ? get().budgets.find((b) => b.category_id === input.category_id) : undefined;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const before = budget ? await repo.getCategorySpendSince(budget.category_id, monthStart) : 0;

    await repo.createTransaction(input);
    await Promise.all([get().refreshTransactions(), get().refreshAccounts()]);

    if (budget && budget.monthly_limit > 0) {
      const after = before + input.amount;
      const name = get().categories.find((c) => c.id === budget.category_id)?.name ?? 'A category';
      const limit = budget.monthly_limit;
      if (before < limit && after >= limit) {
        notifyNow(`${name} budget exceeded`, `${formatMoney(after, budget.currency)} of ${formatMoney(limit, budget.currency)} this month`);
      } else if (before < limit * 0.8 && after >= limit * 0.8) {
        notifyNow(`${name} budget at ${Math.round((after / limit) * 100)}%`, `${formatMoney(limit - after, budget.currency)} left this month`);
      }
    }
  },
  updateTransaction: async (id, patch) => {
    await repo.updateTransaction(id, patch);
    await Promise.all([get().refreshTransactions(), get().refreshAccounts()]);
  },
  removeTransaction: async (id) => {
    await repo.deleteTransaction(id);
    await Promise.all([get().refreshTransactions(), get().refreshAccounts()]);
  },

  addAccount: async (input) => {
    await repo.createAccount(input);
    await get().refreshAccounts();
  },
  updateAccount: async (id, patch) => {
    await repo.updateAccount(id, patch);
    await get().refreshAccounts();
  },
  addCategory: async (input) => {
    await repo.createCategory(input);
    await get().refreshCategories();
  },
  deleteCategory: async (id) => {
    await repo.deleteCategory(id);
    await get().refreshCategories();
  },

  addRecurringRule: async (input) => {
    const id = await repo.createRecurringRule(input);
    await get().refreshRecurring();
    const rule = get().recurringRules.find((r) => r.id === id);
    if (rule) scheduleBillReminder(rule);
  },
  removeRecurringRule: async (id) => {
    await repo.deleteRecurringRule(id);
    await cancelBillReminder(id);
    await get().refreshRecurring();
  },
  postRecurring: async (rule) => {
    await repo.postRecurringRule(rule);
    await Promise.all([get().refreshRecurring(), get().refreshTransactions(), get().refreshAccounts()]);
    const updated = get().recurringRules.find((r) => r.id === rule.id);
    if (updated) scheduleBillReminder(updated);
  },
  skipRecurring: async (rule) => {
    await repo.skipRecurringCycle(rule);
    await get().refreshRecurring();
    const updated = get().recurringRules.find((r) => r.id === rule.id);
    if (updated) scheduleBillReminder(updated);
  },
  setRecurringAutoPost: async (id, on) => {
    await repo.setRecurringAutoPost(id, on);
    await get().refreshRecurring();
  },
  setRecurringPaused: async (id, paused) => {
    await repo.setRecurringPaused(id, paused);
    await get().refreshRecurring();
    if (paused) {
      await cancelBillReminder(id);
    } else {
      const rule = get().recurringRules.find((r) => r.id === id);
      if (rule) scheduleBillReminder(rule);
    }
  },

  addDebt: async (input) => {
    await repo.createDebt(input);
    await get().refreshDebts();
  },
  payDebt: async (debtId, amount, note) => {
    await repo.recordDebtPayment(debtId, amount, note);
    await get().refreshDebts();
  },
  removeDebt: async (id) => {
    await repo.deleteDebt(id);
    await get().refreshDebts();
  },

  addSavingsGoal: async (input) => {
    await repo.createSavingsGoal(input);
    await get().refreshSavings();
  },
  contributeToGoal: async (goalId, amount, note) => {
    await repo.contributeSavingsGoal(goalId, amount, note);
    await get().refreshSavings();
  },
  removeSavingsGoal: async (id) => {
    await repo.deleteSavingsGoal(id);
    await get().refreshSavings();
  },

  setBudget: async (categoryId, monthlyLimit, currency) => {
    await repo.setBudget(categoryId, monthlyLimit, currency);
    await get().refreshBudgets();
  },
  removeBudget: async (id) => {
    await repo.deleteBudget(id);
    await get().refreshBudgets();
  },

  setFxRate: async (currency, rateToBase) => {
    await fxRepo.setFxRate(currency, rateToBase);
    await get().refreshFxRates();
  },
  removeFxRate: async (currency) => {
    await fxRepo.deleteFxRate(currency);
    await get().refreshFxRates();
  },
}));
