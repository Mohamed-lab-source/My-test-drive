import type { Account, Transaction } from '../db/types';

// How a transaction moves this account's balance.
export function effectOn(accountId: string, t: Transaction): number {
  if (t.type === 'income') return t.account_id === accountId ? t.amount : 0;
  if (t.type === 'expense') return t.account_id === accountId ? -t.amount : 0;
  let d = 0;
  if (t.account_id === accountId) d -= t.amount;
  if (t.transfer_to_account_id === accountId) d += t.amount;
  return d;
}

export interface StatementRow {
  tx: Transaction;
  delta: number;
  running: number;
}

export interface Statement {
  opening: number;
  closing: number;
  inflow: number;
  outflow: number;
  rows: StatementRow[];
}

// Works backwards from today's balance: closing = balance minus everything
// after the period; opening = closing minus everything inside it.
export function buildStatement(account: Account, txs: Transaction[], start: Date, end: Date): Statement {
  const s = start.getTime();
  const e = end.getTime();
  const after = txs.filter((t) => new Date(t.date).getTime() >= e).reduce((sum, t) => sum + effectOn(account.id, t), 0);
  const inside = txs
    .filter((t) => {
      const ts = new Date(t.date).getTime();
      return ts >= s && ts < e;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const closing = account.balance - after;
  const opening = closing - inside.reduce((sum, t) => sum + effectOn(account.id, t), 0);
  let running = opening;
  let inflow = 0;
  let outflow = 0;
  const rows = inside.map((tx) => {
    const delta = effectOn(account.id, tx);
    running += delta;
    if (delta > 0) inflow += delta;
    else outflow -= delta;
    return { tx, delta, running };
  });
  return { opening, closing, inflow, outflow, rows };
}

export interface Period {
  key: string;
  label: string;
  start: Date;
  end: Date; // exclusive
  dueDate?: Date;
}

// Statement periods, newest first: credit-card cycles when a statement day
// is set (the cycle closes on that day), otherwise calendar months.
export function statementPeriods(account: Account, count = 6, now: Date = new Date()): Period[] {
  const out: Period[] = [];
  const sd = account.type === 'credit' ? account.statement_day : null;
  if (sd) {
    const clamp = (y: number, m: number, d: number) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
    // The next closing date on or after today.
    let close = clamp(now.getFullYear(), now.getMonth(), sd);
    if (close.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) close = clamp(now.getFullYear(), now.getMonth() + 1, sd);
    for (let i = 0; i < count; i++) {
      const end = new Date(close.getFullYear(), close.getMonth(), close.getDate() + 1);
      const prevClose = clamp(close.getFullYear(), close.getMonth() - 1, sd);
      const start = new Date(prevClose.getFullYear(), prevClose.getMonth(), prevClose.getDate() + 1);
      const due = account.due_day
        ? clamp(close.getFullYear(), close.getMonth() + (account.due_day <= sd ? 1 : 0), account.due_day)
        : undefined;
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      out.push({ key: `c${i}`, label: i === 0 ? 'Current cycle' : `${fmt(start)} – ${fmt(close)}`, start, end, dueDate: due });
      close = prevClose;
    }
    return out;
  }
  for (let i = 0; i < count; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ key: `m${i}`, label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), start, end });
  }
  return out;
}
