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
import {
  cancelBillReminder,
  cancelDebtReminder,
  notifyNow,
  scheduleBillReminder,
  scheduleDebtReminder,
  rescheduleCardDueReminders,
  scheduleSpendDigest,
} from '../notifications/scheduler';
import { settingsHydrated, useSettingsStore } from './settingsStore';
import { computePlan } from '../features/money/plan';
import { limitCrossing } from '../utils/spendingPlan';
import { convertToBase } from '../db/repositories/fx';
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

  addTransaction: (input: Parameters<typeof repo.createTransaction>[0]) => Promise<string>;
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

  refreshTransactions: async () => {
    set({ transactions: await repo.listTransactions(200) });
    refreshMoneyWidget();
    scheduleSpendDigest(get().transactions, get().accounts).catch(() => {});
  },
  refreshAccounts: async () => {
    set({ accounts: await repo.listAccounts() });
    refreshMoneyWidget();
    rescheduleCardDueReminders(get().accounts).catch(() => {});
    await get().recordNetWorthSnapshot();
  },
  // One snapshot per local day, overwritten as balances change during it.
  recordNetWorthSnapshot: async () => {
    await settingsHydrated();
    const base = useSettingsStore.getState().currency;
    const { accounts, fxRates } = get();
    const excluded = useSettingsStore.getState().excludedAccounts;
    const total = accounts.filter((a) => !excluded.includes(a.id)).reduce((sum, a) => sum + fxRepo.convertToBase(a.balance, a.currency, base, fxRates), 0);
    await repo.upsertNetWorthSnapshot(todayKey(), total, base);
    set({ netWorthHistory: await repo.listNetWorthSnapshots() });
  },
  refreshRecurring: async () => {
    set({ recurringRules: await repo.listRecurringRules() });
    refreshMoneyWidget();
  },
  refreshDebts: async () => {
    const debts = await repo.listDebts();
    set({ debts });
    // Keeps due-date reminders in step with adds, payments and undo-restores.
    for (const d of debts) scheduleDebtReminder(d);
  },
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

    const accountBefore = get().accounts.find((a) => a.id === input.account_id);
    const id = await repo.createTransaction(input);
    await Promise.all([get().refreshTransactions(), get().refreshAccounts()]);

    // Low-balance alert: only when this transaction takes the account from
    // above the threshold to below it, so it fires once rather than nagging.
    const threshold = useSettingsStore.getState().lowBalanceAlert;
    const accountAfter = get().accounts.find((a) => a.id === input.account_id);
    if (threshold > 0 && accountBefore && accountAfter && accountAfter.type !== 'credit') {
      if (accountBefore.balance >= threshold && accountAfter.balance < threshold) {
        notifyNow(
          `${accountAfter.name} is running low`,
          `Balance is now ${formatMoney(accountAfter.balance, accountAfter.currency)} — below your ${formatMoney(threshold, accountAfter.currency)} alert.`
        );
      }
    }

    // Spending limits (daily / weekly / monthly, from Settings or the
    // spending plan), your own limit on this account, and credit used.
    // Each fires once, as this expense crosses 80% or 100%; only the most
    // important one is sent.
    if (input.type === 'expense' && useSettingsStore.getState().limitAlerts) {
      await checkSpendingAlerts(input, accountBefore, get).catch(() => {});
    }

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
    return id;
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
    await cancelDebtReminder(id);
    await get().refreshDebts();
  },

  addSavingsGoal: async (input) => {
    await repo.createSavingsGoal(input);
    await get().refreshSavings();
  },
  contributeToGoal: async (goalId, amount, note) => {
    const before = get().savingsGoals.find((g) => g.id === goalId);
    await repo.contributeSavingsGoal(goalId, amount, note);
    await get().refreshSavings();
    // Celebrate crossing 25 / 50 / 75 / 100%.
    const after = get().savingsGoals.find((g) => g.id === goalId);
    if (before && after && after.target_amount > 0) {
      const pctBefore = before.current_amount / before.target_amount;
      const pctAfter = after.current_amount / after.target_amount;
      const crossed = [1, 0.75, 0.5, 0.25].find((m) => pctBefore < m && pctAfter >= m);
      if (crossed === 1) notifyNow(`🎉 ${after.name} — goal reached!`, `You've saved ${formatMoney(after.target_amount, after.currency)}.`);
      else if (crossed) notifyNow(`${after.name}: ${Math.round(crossed * 100)}% there`, `${formatMoney(after.target_amount - after.current_amount, after.currency)} to go.`);
    }
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

type Getter = () => { accounts: Account[]; fxRates: FxRate[] };

async function checkSpendingAlerts(
  input: Parameters<typeof repo.createTransaction>[0],
  accountBefore: Account | undefined,
  get: Getter
): Promise<void> {
  const settings = useSettingsStore.getState();
  const base = settings.currency;
  const alerts: { rank: number; title: string; body: string }[] = [];
  const now = new Date();
  const when = new Date(input.date);

  if (!input.recurring_id) {
    const plan = await computePlan(now);
    const amount = convertToBase(input.amount, input.currency, base, get().fxRates);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart.getTime() - ((now.getDay() - settings.weekStart + 7) % 7) * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periods = [
      { key: 'monthly' as const, start: monthStart, word: 'this month', name: 'Monthly', rank: 3 },
      { key: 'weekly' as const, start: weekStart, word: 'this week', name: 'Weekly', rank: 2 },
      { key: 'daily' as const, start: dayStart, word: 'today', name: 'Daily', rank: 1 },
    ];
    for (const p of periods) {
      if (when < p.start) continue;
      const l = plan[p.key];
      const crossed = limitCrossing(l.spent - amount, l.spent, l.limit);
      if (crossed === 'over') {
        alerts.push({ rank: 10 + p.rank, title: `${p.name} limit reached`, body: `${formatMoney(l.spent, base)} spent ${p.word} — your limit is ${formatMoney(l.limit, base)}.` });
      } else if (crossed === 'warn') {
        alerts.push({ rank: p.rank, title: `80% of your ${p.name.toLowerCase()} limit`, body: `${formatMoney(Math.max(0, l.left), base)} left ${p.word} of ${formatMoney(l.limit, base)}.` });
      }
    }
  }

  // One big purchase on its own, whatever the limits say.
  const big = settings.bigExpenseAlert;
  const amountBase = convertToBase(input.amount, input.currency, base, get().fxRates);
  if (big > 0 && amountBase >= big) {
    alerts.push({ rank: 7, title: `Large expense: ${formatMoney(input.amount, input.currency)}`, body: `${input.note ?? 'A purchase'} — over your ${formatMoney(big, base)} alert.` });
  }

  const account = get().accounts.find((a) => a.id === input.account_id);
  if (account?.monthly_limit) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const txs = await repo.listTransactionsInRange(monthStart, new Date(now.getTime() + 86400000).toISOString());
    const spent = txs.filter((t) => t.type === 'expense' && t.account_id === account.id && t.currency === account.currency).reduce((s, t) => s + t.amount, 0);
    const amount = input.currency === account.currency ? input.amount : 0;
    const crossed = limitCrossing(spent - amount, spent, account.monthly_limit);
    if (crossed) {
      alerts.push({
        rank: crossed === 'over' ? 9 : 5,
        title: crossed === 'over' ? `${account.name}: monthly limit reached` : `${account.name}: 80% of your limit`,
        body: `${formatMoney(spent, account.currency)} of ${formatMoney(account.monthly_limit, account.currency)} this month.`,
      });
    }
  }

  // Credit used on a card, at 30% (where scores start to suffer), 70% and 90%.
  if (account?.type === 'credit' && account.credit_limit && accountBefore) {
    const before = Math.max(0, -accountBefore.balance) / account.credit_limit;
    const after = Math.max(0, -account.balance) / account.credit_limit;
    const line = [0.9, 0.7, 0.3].find((x) => before < x && after >= x);
    if (line) {
      alerts.push({
        rank: line === 0.9 ? 8 : line === 0.7 ? 6 : 4,
        title: `${account.name} is at ${Math.round(after * 100)}% of its limit`,
        body: `${formatMoney(Math.max(0, account.credit_limit + account.balance), account.currency)} available of ${formatMoney(account.credit_limit, account.currency)}.`,
      });
    }
  }

  const top = alerts.sort((a, b) => b.rank - a.rank)[0];
  if (top) await notifyNow(top.title, top.body, '/money/plan');
}
