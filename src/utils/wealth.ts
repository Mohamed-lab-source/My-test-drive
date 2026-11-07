// Saving, backup money (an emergency fund) and investing, from your own
// numbers. Pure helpers; amounts are minor units in your main currency.

// ---------- Months of income and spending ----------

export interface WealthTx {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  note: string | null;
  category: string | null;
}

export interface MonthTotals {
  start: Date;
  end: Date;
  income: number;
  expense: number;
  saved: number;
  // Saved as a share of income, or null with no income.
  rate: number | null;
}

export function monthTotals(txs: WealthTx[], periods: { start: Date; end: Date }[]): MonthTotals[] {
  return periods.map(({ start, end }) => {
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      const at = new Date(t.date).getTime();
      if (at < start.getTime() || at >= end.getTime()) continue;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
    return { start, end, income, expense, saved: income - expense, rate: income > 0 ? (income - expense) / income : null };
  });
}

// Spending you can't easily drop: food at home, bills, transport, health,
// rent, school, insurance.
export const ESSENTIAL = /grocer|utilit|bill|transport|health|medic|pharm|rent|home|housing|education|school|insurance|phone|internet|fuel|بقال|فواتير|ايجار|إيجار|دواء|مدرسة/i;

// Average monthly spending over the months given (ignoring empty ones).
export function averageSpend(txs: WealthTx[], periods: { start: Date; end: Date }[], essentialsOnly = false): number {
  const months = periods
    .map(({ start, end }) =>
      txs
        .filter((t) => t.type === 'expense' && (!essentialsOnly || (t.category && ESSENTIAL.test(t.category))))
        .filter((t) => {
          const at = new Date(t.date).getTime();
          return at >= start.getTime() && at < end.getTime();
        })
        .reduce((s, t) => s + t.amount, 0)
    )
    .filter((x) => x > 0);
  return months.length ? Math.round(months.reduce((s, x) => s + x, 0) / months.length) : 0;
}

// Monthly average spent on notes matching a pattern (rides, delivery…).
export function habitMonthly(txs: WealthTx[], re: RegExp, periods: { start: Date; end: Date }[]): number {
  if (!periods.length) return 0;
  let sum = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !t.note || !re.test(t.note)) continue;
    const at = new Date(t.date).getTime();
    if (periods.some((p) => at >= p.start.getTime() && at < p.end.getTime())) sum += t.amount;
  }
  return Math.round(sum / periods.length);
}

// ---------- Backup money (emergency fund) ----------

export type BackupLevel = 'none' | 'starter' | 'building' | 'full';

export interface BackupStatus {
  saved: number;
  monthly: number;
  // How many months the backup would last.
  months: number;
  targetMonths: number;
  target: number;
  gap: number;
  level: BackupLevel;
  // To fill the gap in 6 or 12 months.
  per6: number;
  per12: number;
}

export function backupStatus(saved: number, monthly: number, targetMonths: number): BackupStatus {
  const months = monthly > 0 ? saved / monthly : saved > 0 ? Infinity : 0;
  const target = monthly * targetMonths;
  const gap = Math.max(0, target - saved);
  const level: BackupLevel = monthly <= 0 && saved <= 0 ? 'none' : months >= targetMonths ? 'full' : months >= 1 ? 'building' : saved > 0 ? 'starter' : 'none';
  return { saved, monthly, months, targetMonths, target, gap, level, per6: Math.ceil(gap / 6), per12: Math.ceil(gap / 12) };
}

// ---------- The order to do things in ----------

export interface LadderStep {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  route: string;
}

export function moneyLadder(i: {
  tracking: boolean;
  backupMonths: number;
  targetMonths: number;
  cardDebt: number;
  otherDebt: number;
  savingRate: number | null;
  investing: boolean;
  fmt: (n: number) => string;
}): { steps: LadderStep[]; current: number } {
  const steps: LadderStep[] = [
    { id: 'track', title: 'Know where your money goes', detail: 'Log spending (bank SMS does most of it) for a month or two.', done: i.tracking, route: '/money/transactions' },
    { id: 'starter', title: 'Starter backup: one month of spending', detail: 'Enough for a surprise bill, kept apart from your spending money.', done: i.backupMonths >= 1, route: '/money/wealth?tab=backup' },
    {
      id: 'cards',
      title: 'Clear credit card balances',
      detail: i.cardDebt > 0 ? `${i.fmt(i.cardDebt)} on your cards. Card interest is higher than any investment returns.` : 'Pay cards in full every month.',
      done: i.cardDebt <= 0,
      route: '/money/debt-plan',
    },
    { id: 'save', title: 'Save every month', detail: 'Aim for at least 10–20% of income, paid to yourself on payday.', done: (i.savingRate ?? 0) >= 0.1, route: '/money/wealth?tab=save' },
    { id: 'full', title: `Full backup: ${i.targetMonths} months`, detail: 'Covers losing income or a big health or car bill without debt.', done: i.backupMonths >= i.targetMonths, route: '/money/wealth?tab=backup' },
    {
      id: 'debts',
      title: 'Pay back what you owe',
      detail: i.otherDebt > 0 ? `${i.fmt(i.otherDebt)} still owed to people or loans.` : 'No other debts.',
      done: i.otherDebt <= 0,
      route: '/money/debt-plan',
    },
    { id: 'invest', title: 'Invest every month', detail: 'Spread across gold, stocks/funds and safe savings to beat inflation.', done: i.investing, route: '/money/wealth?tab=invest' },
  ];
  const current = steps.findIndex((s) => !s.done);
  return { steps, current: current < 0 ? steps.length : current };
}

// ---------- What saving adds up to ----------

// Monthly saving with monthly compounding; "real" is in today's money.
export function projection(monthly: number, years: number, returnPct: number, start = 0, inflationPct = 0): { nominal: number; real: number; paidIn: number } {
  const n = Math.round(years * 12);
  const grow = (ratePct: number) => {
    const r = ratePct / 100 / 12;
    if (Math.abs(r) < 1e-12) return start + monthly * n;
    const f = Math.pow(1 + r, n);
    return start * f + (monthly * (f - 1)) / r;
  };
  const realRate = ((1 + returnPct / 100) / (1 + inflationPct / 100) - 1) * 100;
  return { nominal: Math.round(grow(returnPct)), real: Math.round(grow(realRate)), paidIn: start + monthly * n };
}

// What cash loses in a year to inflation.
export const inflationLoss = (amount: number, inflationPct: number) => Math.round(amount - amount / (1 + inflationPct / 100));

// ---------- Investing ----------

export type RiskProfile = 'careful' | 'balanced' | 'growth';
export type Bucket = 'safe' | 'gold' | 'stocks' | 'fx';

export const BUCKETS: { id: Bucket; label: string; emoji: string }[] = [
  { id: 'safe', label: 'Safe savings', emoji: '🏦' },
  { id: 'gold', label: 'Gold', emoji: '🪙' },
  { id: 'stocks', label: 'Stocks & funds', emoji: '📈' },
  { id: 'fx', label: 'Foreign currency', emoji: '💵' },
];

// A general starting mix per style (percent). Not advice for anyone in
// particular — a sensible spread to adjust.
export const TARGET_MIX: Record<RiskProfile, Record<Bucket, number>> = {
  careful: { safe: 50, gold: 25, stocks: 15, fx: 10 },
  balanced: { safe: 35, gold: 20, stocks: 35, fx: 10 },
  growth: { safe: 20, gold: 15, stocks: 55, fx: 10 },
};

export const RISK_QUESTIONS: { q: string; options: string[] }[] = [
  { q: 'When will you need this money?', options: ['Within 2 years', 'In 2–5 years', 'In 5+ years'] },
  { q: 'If it fell 20% in a month, you would…', options: ['Sell to stop the loss', 'Wait it out', 'Buy more while cheap'] },
  { q: 'Your income is…', options: ['Irregular', 'Steady', 'Steady, with money left over'] },
  { q: 'Your investing experience', options: ['None yet', 'Some', 'A lot'] },
];

export function riskProfile(answers: number[]): RiskProfile {
  const score = answers.reduce((s, a) => s + Math.max(0, Math.min(2, a)), 0);
  // Money needed soon is never "growth" money.
  if (answers[0] === 0) return 'careful';
  return score <= 3 ? 'careful' : score <= 5 ? 'balanced' : 'growth';
}

export type HoldingKind = 'gold' | 'certificate' | 'sukuk' | 'moneyMarket' | 'stocks' | 'fund' | 'fx' | 'property' | 'other';

export const HOLDING_KINDS: { id: HoldingKind; label: string; emoji: string; bucket: Bucket | null; interest: boolean; note: string }[] = [
  { id: 'gold', label: 'Gold', emoji: '🪙', bucket: 'gold', interest: false, note: 'Bars, coins or jewellery, by weight. Holds value against the pound over time; prices swing in the short run.' },
  { id: 'certificate', label: 'Bank certificate', emoji: '📜', bucket: 'safe', interest: true, note: 'Fixed return for a fixed time. Conventional certificates pay interest (riba); Islamic banks offer profit-sharing ones.' },
  { id: 'sukuk', label: 'Sukuk / Islamic savings', emoji: '🕌', bucket: 'safe', interest: false, note: 'Sharia-compliant fixed-income: profit from real assets instead of interest.' },
  { id: 'moneyMarket', label: 'Money market fund', emoji: '💧', bucket: 'safe', interest: true, note: 'Daily liquidity, low risk. Conventional funds earn interest; Islamic money funds exist.' },
  { id: 'stocks', label: 'Stocks', emoji: '📈', bucket: 'stocks', interest: false, note: 'Ownership in companies: higher long-run growth, bigger swings. For a halal choice, use Sharia-screened companies.' },
  { id: 'fund', label: 'Investment fund', emoji: '🧺', bucket: 'stocks', interest: false, note: 'A ready-made basket of stocks run by a manager — easy diversification. Islamic equity funds exist.' },
  { id: 'fx', label: 'Foreign currency', emoji: '💵', bucket: 'fx', interest: false, note: 'Dollars or euros as a hedge against the pound. Exchange hand to hand at the going rate.' },
  { id: 'property', label: 'Property / land', emoji: '🏠', bucket: null, interest: false, note: 'Long-term and hard to sell quickly — kept outside the mix.' },
  { id: 'other', label: 'Other', emoji: '📦', bucket: null, interest: false, note: 'Anything else you hold.' },
];

export const kindInfo = (k: HoldingKind) => HOLDING_KINDS.find((h) => h.id === k) ?? HOLDING_KINDS[HOLDING_KINDS.length - 1];

export interface Holding {
  kind: HoldingKind;
  name: string;
  // What you put in, in minor units (in `currency`).
  invested: number;
  // Today's value if you know it (minor units, `currency`); null = invested.
  value: number | null;
  currency: string;
  // Gold.
  grams: number | null;
  karat: 24 | 21 | 18 | null;
  // Certificates and sukuk.
  ratePct: number | null;
  maturity: string | null;
  // Can be sold within days without a penalty (counts toward backup money if chosen).
  liquid: boolean;
  note: string | null;
}

// Value in your main currency: gold from today's 24k price, foreign
// currency through your rates, the rest from what you entered.
export function holdingValue(h: Holding, gold24Major: number, toBase: (amount: number, currency: string) => number): number {
  if (h.kind === 'gold' && h.grams && gold24Major > 0) return Math.round(h.grams * gold24Major * ((h.karat ?? 21) / 24) * 100);
  return toBase(h.value ?? h.invested, h.currency);
}

export function allocation(values: { bucket: Bucket | null; value: number }[]): { total: number; by: Record<Bucket, number>; pct: Record<Bucket, number> } {
  const by: Record<Bucket, number> = { safe: 0, gold: 0, stocks: 0, fx: 0 };
  for (const v of values) if (v.bucket) by[v.bucket] += v.value;
  const total = Object.values(by).reduce((s, x) => s + x, 0);
  const pct = Object.fromEntries(BUCKETS.map((b) => [b.id, total ? (by[b.id] / total) * 100 : 0])) as Record<Bucket, number>;
  return { total, by, pct };
}

// Where this month's investing should go to move toward the target mix:
// into whatever is furthest below its share.
export function splitMonthly(monthly: number, by: Record<Bucket, number>, target: Record<Bucket, number>): Record<Bucket, number> {
  const ids = BUCKETS.map((b) => b.id);
  const totalAfter = ids.reduce((s, b) => s + by[b], 0) + monthly;
  const need = Object.fromEntries(ids.map((b) => [b, Math.max(0, (target[b] / 100) * totalAfter - by[b])])) as Record<Bucket, number>;
  const sum = ids.reduce((s, b) => s + need[b], 0);
  const out = Object.fromEntries(ids.map((b) => [b, sum > 0 ? Math.round((monthly * need[b]) / sum) : Math.round((monthly * target[b]) / 100)])) as Record<Bucket, number>;
  // Keep the parts adding up exactly.
  const diff = monthly - ids.reduce((s, b) => s + out[b], 0);
  const biggest = ids.reduce((a, b) => (out[b] > out[a] ? b : a), ids[0]);
  out[biggest] += diff;
  return out;
}

// Buckets more than 5 points off target.
export function rebalanceHints(pct: Record<Bucket, number>, target: Record<Bucket, number>, total: number): { bucket: Bucket; diff: number }[] {
  if (total <= 0) return [];
  return BUCKETS.map((b) => ({ bucket: b.id, diff: pct[b.id] - target[b.id] }))
    .filter((x) => Math.abs(x.diff) >= 5)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// Certificates and sukuk maturing within `days`.
export function maturingSoon(holdings: (Holding & { id: string })[], now: Date, days = 30) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return holdings
    .filter((h) => h.maturity)
    .map((h) => ({ h, days: Math.round((new Date(`${h.maturity}T00:00:00`).getTime() - today) / 86400000) }))
    .filter((x) => x.days >= 0 && x.days <= days)
    .sort((a, b) => a.days - b.days);
}
