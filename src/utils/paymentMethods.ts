import type { Account, Transaction } from '../db/types';

export type PaymentMethod = 'credit' | 'debit' | 'cash';

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  credit: '💳 Credit card',
  debit: '🏦 Debit / bank',
  cash: '💵 Cash & wallet',
};

// Credit-card accounts are "credit"; cash and wallets are "cash"; bank and
// savings accounts are paid by debit card or transfer.
export function methodOf(account: Account | undefined): PaymentMethod {
  if (!account) return 'debit';
  if (account.type === 'credit') return 'credit';
  if (account.type === 'cash' || account.type === 'wallet') return 'cash';
  return 'debit';
}

// Spending (expenses only, in the given currency) split by how it was paid.
export function spendByMethod(
  transactions: Transaction[],
  accounts: Account[],
  currency: string,
  from: string,
  to?: string
): Record<PaymentMethod, number> {
  const out: Record<PaymentMethod, number> = { credit: 0, debit: 0, cash: 0 };
  for (const t of transactions) {
    if (t.type !== 'expense' || t.currency !== currency || t.date < from || (to && t.date >= to)) continue;
    out[methodOf(accounts.find((a) => a.id === t.account_id))] += t.amount;
  }
  return out;
}
