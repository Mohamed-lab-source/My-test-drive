import { create } from 'zustand';
import type {
  Account,
  Category,
  Debt,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from '../db/types';
import * as repo from '../db/repositories/finance';
import { seedDefaultsIfEmpty } from '../db/seed';

interface FinanceState {
  loaded: boolean;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];

  hydrate: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshRecurring: () => Promise<void>;
  refreshDebts: () => Promise<void>;
  refreshSavings: () => Promise<void>;
  refreshCategories: () => Promise<void>;

  addTransaction: (input: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  addAccount: (input: Parameters<typeof repo.createAccount>[0]) => Promise<void>;
  addCategory: (input: Parameters<typeof repo.createCategory>[0]) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  addRecurringRule: (input: Parameters<typeof repo.createRecurringRule>[0]) => Promise<void>;
  removeRecurringRule: (id: string) => Promise<void>;
  postRecurring: (rule: RecurringRule) => Promise<void>;

  addDebt: (input: Parameters<typeof repo.createDebt>[0]) => Promise<void>;
  payDebt: (debtId: string, amount: number, note?: string) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;

  addSavingsGoal: (input: Parameters<typeof repo.createSavingsGoal>[0]) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number, note?: string) => Promise<void>;
  removeSavingsGoal: (id: string) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  loaded: false,
  categories: [],
  accounts: [],
  transactions: [],
  recurringRules: [],
  debts: [],
  savingsGoals: [],

  hydrate: async () => {
    const [categories, accounts] = await Promise.all([repo.listCategories(), repo.listAccounts()]);
    await seedDefaultsIfEmpty(categories.length, accounts.length);
    const [cats2, accs2, transactions, recurringRules, debts, savingsGoals] = await Promise.all([
      repo.listCategories(),
      repo.listAccounts(),
      repo.listTransactions(200),
      repo.listRecurringRules(),
      repo.listDebts(),
      repo.listSavingsGoals(),
    ]);
    set({
      categories: cats2,
      accounts: accs2,
      transactions,
      recurringRules,
      debts,
      savingsGoals,
      loaded: true,
    });
  },

  refreshTransactions: async () => set({ transactions: await repo.listTransactions(200) }),
  refreshAccounts: async () => set({ accounts: await repo.listAccounts() }),
  refreshRecurring: async () => set({ recurringRules: await repo.listRecurringRules() }),
  refreshDebts: async () => set({ debts: await repo.listDebts() }),
  refreshSavings: async () => set({ savingsGoals: await repo.listSavingsGoals() }),
  refreshCategories: async () => set({ categories: await repo.listCategories() }),

  addTransaction: async (input) => {
    await repo.createTransaction(input);
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
  addCategory: async (input) => {
    await repo.createCategory(input);
    await get().refreshCategories();
  },
  deleteCategory: async (id) => {
    await repo.deleteCategory(id);
    await get().refreshCategories();
  },

  addRecurringRule: async (input) => {
    await repo.createRecurringRule(input);
    await get().refreshRecurring();
  },
  removeRecurringRule: async (id) => {
    await repo.deleteRecurringRule(id);
    await get().refreshRecurring();
  },
  postRecurring: async (rule) => {
    await repo.postRecurringRule(rule);
    await Promise.all([get().refreshRecurring(), get().refreshTransactions(), get().refreshAccounts()]);
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
}));
