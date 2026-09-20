import { getDb, newId, nowIso } from '../client';
import { allRows, deleteRow, getRow, insertRow, updateRow, whereRows } from '../helpers';
import type {
  Account,
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
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [delta, accountId]);
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

export async function createTransaction(
  input: Omit<Transaction, 'id' | 'created_at'>
): Promise<string> {
  const id = newId();
  await insertRow('transactions', { id, ...input, created_at: nowIso() });

  if (input.type === 'income') {
    await adjustAccountBalance(input.account_id, input.amount);
  } else if (input.type === 'expense') {
    await adjustAccountBalance(input.account_id, -input.amount);
  } else if (input.type === 'transfer') {
    await adjustAccountBalance(input.account_id, -input.amount);
    await adjustAccountBalance(input.transfer_to_account_id, input.amount);
  }
  return id;
}

export async function deleteTransaction(id: string): Promise<void> {
  const tx = await getRow<Transaction>('transactions', id);
  if (!tx) return;
  if (tx.type === 'income') {
    await adjustAccountBalance(tx.account_id, -tx.amount);
  } else if (tx.type === 'expense') {
    await adjustAccountBalance(tx.account_id, tx.amount);
  } else if (tx.type === 'transfer') {
    await adjustAccountBalance(tx.account_id, tx.amount);
    await adjustAccountBalance(tx.transfer_to_account_id, -tx.amount);
  }
  await deleteRow('transactions', id);
}

// ---------- Recurring rules (subscriptions & recurring expenses/income) ----------
export const listRecurringRules = () => allRows<RecurringRule>('recurring_rules', 'next_due_date ASC');
export const getRecurringRule = (id: string) => getRow<RecurringRule>('recurring_rules', id);

export async function createRecurringRule(
  input: Omit<RecurringRule, 'id' | 'created_at' | 'is_active'>
) {
  const id = newId();
  await insertRow('recurring_rules', { id, ...input, is_active: 1, created_at: nowIso() });
  return id;
}
export const updateRecurringRule = (id: string, patch: Partial<RecurringRule>) =>
  updateRow('recurring_rules', id, patch);
export const deleteRecurringRule = (id: string) => deleteRow('recurring_rules', id);

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
