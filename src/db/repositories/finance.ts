import { newId, nowIso } from '../client';
import { allRows, deleteRow, getRow, insertRow, updateRow, whereRows } from '../helpers';
import type {
  Account,
  Budget,
  NetWorthSnapshot,
  Category,
  Debt,
  DebtPayment,
  RecurringRule,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from '../types';

// ---------- Categories ----------
export const listCategories = () => allRows<Category>('categories', 'sort_order ASC');

export async function createCategory(input: Omit<Category, 'id' | 'is_archived'>) {
  const id = newId();
  await insertRow('categories', { id, ...input, is_archived: 0 });
  return id;
}
export const updateCategory = (id: string, patch: Partial<Category>) =>
  updateRow('categories', id, patch);
export const archiveCategory = (id: string) => updateRow('categories', id, { is_archived: 1 });
export const deleteCategory = (id: string) => deleteRow('categories', id);

// ---------- Accounts ----------
export const listAccounts = () => allRows<Account>('accounts', 'sort_order ASC');

export async function createAccount(
  input: Omit<Account, 'id' | 'created_at' | 'is_archived' | 'balance'> & { balance?: number }
) {
  const id = newId();
  await insertRow('accounts', {
    id,
    ...input,
    balance: input.balance ?? 0,
    is_archived: 0,
    created_at: nowIso(),
  });
  return id;
}
export const updateAccount = (id: string, patch: Partial<Account>) =>
  updateRow('accounts', id, patch);
export const archiveAccount = (id: string) => updateRow('accounts', id, { is_archived: 1 });
export const deleteAccount = (id: string) => deleteRow('accounts', id);

async function adjustAccountBalance(accountId: string | null, delta: number) {
  if (!accountId) return;
  const account = await getRow<Account>('accounts', accountId);
  if (!account) return;
  await updateRow('accounts', accountId, { balance: account.balance + delta });
}

// ---------- Transactions ----------
export const listTransactions = (limit?: number) =>
  allRows<Transaction>('transactions', `date DESC, created_at DESC${limit ? ` LIMIT ${limit}` : ''}`);

export const listTransactionsInRange = (startIso: string, endIso: string) =>
  whereRows<Transaction>(
    'transactions',
    'date >= ? AND date <= ?',
    [startIso, endIso],
    'date DESC'
  );

export const listTransactionsForAccount = (accountId: string) =>
  whereRows<Transaction>('transactions', 'account_id = ?', [accountId], 'date DESC');

export const listTransactionsForCategory = (categoryId: string) =>
  whereRows<Transaction>('transactions', 'category_id = ?', [categoryId], 'date DESC');

type BalanceFields = Pick<Transaction, 'type' | 'amount' | 'account_id' | 'transfer_to_account_id'>;

// The balance change a transaction applies to each account it touches.
function balanceEffects(tx: BalanceFields): Array<[string | null, number]> {
  if (tx.type === 'income') return [[tx.account_id, tx.amount]];
  if (tx.type === 'expense') return [[tx.account_id, -tx.amount]];
  return [
    [tx.account_id, -tx.amount],
    [tx.transfer_to_account_id, tx.amount],
  ];
}

async function applyBalanceEffects(tx: BalanceFields, sign: 1 | -1): Promise<void> {
  for (const [accountId, delta] of balanceEffects(tx)) {
    await adjustAccountBalance(accountId, sign * delta);
  }
}

export async function createTransaction(
  input: Omit<Transaction, 'id' | 'created_at' | 'receipt_uri'> & { receipt_uri?: string | null }
): Promise<string> {
  const id = newId();
  await insertRow('transactions', { id, ...input, receipt_uri: input.receipt_uri ?? null, created_at: nowIso() });
  await applyBalanceEffects(input, 1);
  return id;
}

// Reverses the old version's balance effect, then applies the edited one,
// so changing amount, type or account keeps every balance correct.
export async function updateTransaction(id: string, patch: Partial<Omit<Transaction, 'id' | 'created_at'>>): Promise<void> {
  const old = await getRow<Transaction>('transactions', id);
  if (!old) return;
  await applyBalanceEffects(old, -1);
  await updateRow('transactions', id, patch);
  await applyBalanceEffects({ ...old, ...patch }, 1);
}

export async function deleteTransaction(id: string): Promise<void> {
  const tx = await getRow<Transaction>('transactions', id);
  if (!tx) return;
  await applyBalanceEffects(tx, -1);
  await deleteRow('transactions', id);
}

// ---------- Recurring rules (subscriptions & recurring expenses/income) ----------
export const listRecurringRules = () => allRows<RecurringRule>('recurring_rules', 'next_due_date ASC');
export const getRecurringRule = (id: string) => getRow<RecurringRule>('recurring_rules', id);

export async function createRecurringRule(
  input: Omit<RecurringRule, 'id' | 'created_at' | 'is_active' | 'is_paused' | 'auto_post'> & { auto_post?: number }
) {
  const id = newId();
  await insertRow('recurring_rules', {
    id,
    ...input,
    auto_post: input.auto_post ?? 0,
    is_active: 1,
    is_paused: 0,
    created_at: nowIso(),
  });
  return id;
}
export const updateRecurringRule = (id: string, patch: Partial<RecurringRule>) =>
  updateRow('recurring_rules', id, patch);
export const deleteRecurringRule = (id: string) => deleteRow('recurring_rules', id);
export const setRecurringPaused = (id: string, paused: boolean) =>
  updateRow('recurring_rules', id, { is_paused: paused ? 1 : 0 });
export const setRecurringAutoPost = (id: string, on: boolean) =>
  updateRow('recurring_rules', id, { auto_post: on ? 1 : 0 });

// Posts every auto-post rule that has come due, catching up on missed
// cycles (e.g. the app wasn't opened for a while) but capped so a
// misconfigured daily rule can't flood the ledger.
const MAX_CATCH_UP = 24;
export async function postDueAutoRules(now: Date = new Date()): Promise<number> {
  const rules = await whereRows<RecurringRule>(
    'recurring_rules',
    'auto_post = 1 AND is_active = 1 AND is_paused = 0 AND next_due_date <= ?',
    [now.toISOString()]
  );
  let posted = 0;
  for (let rule of rules) {
    for (let i = 0; i < MAX_CATCH_UP && new Date(rule.next_due_date) <= now; i++) {
      await postRecurringRule(rule);
      posted++;
      const refreshed = await getRow<RecurringRule>('recurring_rules', rule.id);
      if (!refreshed) break;
      rule = refreshed;
    }
  }
  return posted;
}

// Advances a rule to its next cycle without posting a transaction — for a
// bill you're intentionally not paying this time (e.g. a skipped month).
export async function skipRecurringCycle(rule: RecurringRule): Promise<void> {
  const next = advanceDueDate(rule.next_due_date, rule.frequency, rule.interval_count);
  await updateRecurringRule(rule.id, { next_due_date: next });
}

export function advanceDueDate(dateIso: string, frequency: RecurringRule['frequency'], interval: number): string {
  const d = new Date(dateIso);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + interval);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7 * interval);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + interval);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + interval);
      break;
  }
  return d.toISOString();
}

// Posts the recurring rule as a real transaction for its current due date,
// then rolls next_due_date forward.
export async function postRecurringRule(rule: RecurringRule): Promise<void> {
  await createTransaction({
    type: rule.type,
    amount: rule.amount,
    currency: rule.currency,
    account_id: rule.account_id,
    transfer_to_account_id: null,
    category_id: rule.category_id,
    recurring_id: rule.id,
    note: rule.name,
    date: rule.next_due_date,
  });
  const next = advanceDueDate(rule.next_due_date, rule.frequency, rule.interval_count);
  await updateRecurringRule(rule.id, { next_due_date: next });
}

// ---------- Debts ----------
export const listDebts = () => allRows<Debt>('debts', 'created_at DESC');
export const listDebtPayments = (debtId: string) =>
  whereRows<DebtPayment>('debt_payments', 'debt_id = ?', [debtId], 'date DESC');

export async function createDebt(
  input: Omit<Debt, 'id' | 'created_at' | 'remaining_amount' | 'status'>
) {
  const id = newId();
  await insertRow('debts', {
    id,
    ...input,
    remaining_amount: input.principal_amount,
    status: 'open',
    created_at: nowIso(),
  });
  return id;
}
export const updateDebt = (id: string, patch: Partial<Debt>) => updateRow('debts', id, patch);
export const deleteDebt = (id: string) => deleteRow('debts', id);

export async function recordDebtPayment(debtId: string, amount: number, note?: string) {
  const debt = await getRow<Debt>('debts', debtId);
  if (!debt) return;
  const id = newId();
  await insertRow('debt_payments', { id, debt_id: debtId, amount, date: nowIso(), note: note ?? null });
  const remaining = Math.max(0, debt.remaining_amount - amount);
  await updateDebt(debtId, {
    remaining_amount: remaining,
    status: remaining === 0 ? 'paid' : 'partially_paid',
  });
}

// ---------- Savings goals ----------
export const listSavingsGoals = () => allRows<SavingsGoal>('savings_goals', 'created_at DESC');
export const listSavingsContributions = (goalId: string) =>
  whereRows<SavingsContribution>('savings_contributions', 'goal_id = ?', [goalId], 'date DESC');

export async function createSavingsGoal(
  input: Omit<SavingsGoal, 'id' | 'created_at' | 'current_amount' | 'is_completed'>
) {
  const id = newId();
  await insertRow('savings_goals', {
    id,
    ...input,
    current_amount: 0,
    is_completed: 0,
    created_at: nowIso(),
  });
  return id;
}
export const updateSavingsGoal = (id: string, patch: Partial<SavingsGoal>) =>
  updateRow('savings_goals', id, patch);
export const deleteSavingsGoal = (id: string) => deleteRow('savings_goals', id);

export async function contributeSavingsGoal(goalId: string, amount: number, note?: string) {
  const goal = await getRow<SavingsGoal>('savings_goals', goalId);
  if (!goal) return;
  const id = newId();
  await insertRow('savings_contributions', {
    id,
    goal_id: goalId,
    amount,
    date: nowIso(),
    note: note ?? null,
  });
  const current = goal.current_amount + amount;
  await updateSavingsGoal(goalId, {
    current_amount: current,
    is_completed: current >= goal.target_amount ? 1 : 0,
  });
}

// ---------- Budgets ----------
export const listBudgets = () => allRows<Budget>('budgets', 'created_at ASC');

export async function setBudget(categoryId: string, monthlyLimit: number, currency: string): Promise<void> {
  const existing = await whereRows<Budget>('budgets', 'category_id = ?', [categoryId]);
  if (existing.length > 0) {
    await updateRow('budgets', existing[0].id, { monthly_limit: monthlyLimit, currency });
  } else {
    await insertRow('budgets', {
      id: newId(),
      category_id: categoryId,
      monthly_limit: monthlyLimit,
      currency,
      created_at: nowIso(),
    });
  }
}
export const deleteBudget = (id: string) => deleteRow('budgets', id);

export async function getCategorySpendSince(categoryId: string, sinceIso: string): Promise<number> {
  const rows = await whereRows<Transaction>(
    'transactions',
    "category_id = ? AND type = 'expense' AND date >= ?",
    [categoryId, sinceIso]
  );
  return rows.reduce((sum, t) => sum + t.amount, 0);
}

// ---------- Net worth snapshots ----------
export async function upsertNetWorthSnapshot(dateKey: string, amount: number, currency: string): Promise<void> {
  const existing = await getRow<NetWorthSnapshot>('networth_snapshots', dateKey);
  if (!existing) {
    await insertRow('networth_snapshots', { id: dateKey, amount, currency });
  } else if (existing.amount !== amount || existing.currency !== currency) {
    await updateRow('networth_snapshots', dateKey, { amount, currency });
  }
}

export const listNetWorthSnapshots = (limit = 90) =>
  allRows<NetWorthSnapshot>('networth_snapshots', `id DESC LIMIT ${limit}`).then((rows) => rows.reverse());
