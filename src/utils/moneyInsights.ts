// Pure spending insights over a list of transactions. Amounts are converted
// to the main currency by the caller-supplied `toBase`, so every function
// here works in one currency.
import type { Account, Transaction } from '../db/types';
import { localDateKey } from './date';
import { extractTags } from './tags';

export type ToBase = (amount: number, currency: string) => number;

export interface Spend {
  id: string;
  amount: number; // main currency, minor units
  date: Date;
  key: string; // local YYYY-MM-DD
  month: string; // YYYY-MM
  merchant: string | null; // the note, trimmed
  categoryId: string | null;
  accountId: string | null;
  currency: string;
  recurring: boolean;
}

export function toSpends(txs: Transaction[], toBase: ToBase): Spend[] {
  return txs
    .filter((t) => t.type === 'expense')
    .map((t) => {
      const key = localDateKey(t.date);
      return {
        id: t.id,
        amount: toBase(t.amount, t.currency),
        date: new Date(t.date),
        key,
        month: key.slice(0, 7),
        merchant: t.note?.replace(/\s*\(([A-Z]{3}) [\d.,]+\)$/, '').trim() || null,
        categoryId: t.category_id,
        accountId: t.account_id,
        currency: t.currency,
        recurring: !!t.recurring_id,
      };
    });
}

export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const sum = (xs: Spend[]) => xs.reduce((s, x) => s + x.amount, 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

// ---------- Groups of merchants ----------
export const RIDE_HAILING = /\b(uber(?!\s*eats)|careem|swvl|indrive|didi|bolt|taxi)\b/i;
export const FOOD_DELIVERY = /uber\s*eats|talabat|elmenus|breadfast|deliveroo|instashop|mrsool|hungerstation|noon food/i;
export const GROCERIES = /carrefour|spinneys|seoudi|gourmet|metro|kheir zaman|oscar|lulu|panda|hyper|market|grocer|supe/i;
export const FEES = /\b(fee|fees|commission|charges?|penalty|late payment|interest|vat on fee)\b|رسوم|عمولة|غرامة|فوائد/i;

export function groupStats(spends: Spend[], re: RegExp, month: string, prevMonth: string) {
  const match = spends.filter((s) => s.merchant && re.test(s.merchant));
  const cur = match.filter((s) => s.month === month);
  const prev = match.filter((s) => s.month === prevMonth);
  return { count: cur.length, total: sum(cur), avg: cur.length ? sum(cur) / cur.length : 0, prevTotal: sum(prev), prevCount: prev.length };
}

// ---------- Unusual charges ----------
// A charge more than 3× the median for its category (with enough history).
export function unusualCharges(spends: Spend[], now: Date, days = 30): Spend[] {
  const since = now.getTime() - days * 86400000;
  const byCat = new Map<string, number[]>();
  for (const s of spends) if (s.categoryId) byCat.set(s.categoryId, [...(byCat.get(s.categoryId) ?? []), s.amount]);
  return spends
    .filter((s) => {
      if (s.date.getTime() < since || !s.categoryId || s.recurring) return false;
      const all = byCat.get(s.categoryId)!;
      return all.length >= 6 && s.amount > 3 * median(all);
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

// ---------- Subscription price changes ----------
// Same merchant charged roughly monthly whose latest charge differs from the
// one before by more than 5%.
export function priceChanges(spends: Spend[]): { merchant: string; before: number; after: number; date: Date }[] {
  const byMerchant = new Map<string, Spend[]>();
  for (const s of spends) {
    if (!s.merchant) continue;
    const k = s.merchant.toLowerCase();
    byMerchant.set(k, [...(byMerchant.get(k) ?? []), s]);
  }
  const out: { merchant: string; before: number; after: number; date: Date }[] = [];
  for (const list of byMerchant.values()) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps = sorted.slice(1).map((s, i) => daysBetween(sorted[i].date, s.date));
    const monthly = gaps.every((g) => g >= 25 && g <= 35);
    if (!monthly) continue;
    const [prev, last] = sorted.slice(-2);
    if (Math.abs(last.amount - prev.amount) / prev.amount > 0.05) {
      out.push({ merchant: last.merchant!, before: prev.amount, after: last.amount, date: last.date });
    }
  }
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ---------- When you spend ----------
export const DAYPARTS = [
  { label: 'Night', from: 0, to: 6 },
  { label: 'Morning', from: 6, to: 11 },
  { label: 'Midday', from: 11, to: 15 },
  { label: 'Afternoon', from: 15, to: 18 },
  { label: 'Evening', from: 18, to: 22 },
  { label: 'Late', from: 22, to: 24 },
];
export function byDaypart(spends: Spend[]): number[] {
  const out = DAYPARTS.map(() => 0);
  for (const s of spends) {
    const h = s.date.getHours();
    out[DAYPARTS.findIndex((p) => h >= p.from && h < p.to)] += s.amount;
  }
  return out;
}

// Average spend per weekend day vs per weekday, over the days covered.
export function weekendVsWeekday(spends: Spend[], weekend: number[], from: Date, to: Date) {
  let weekendDays = 0;
  let weekDays = 0;
  for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d.setDate(d.getDate() + 1)) {
    if (weekend.includes(d.getDay())) weekendDays++;
    else weekDays++;
  }
  const inRange = spends.filter((s) => s.date >= from && s.date <= to);
  const we = sum(inRange.filter((s) => weekend.includes(s.date.getDay())));
  const wd = sum(inRange) - we;
  return { weekend: weekendDays ? we / weekendDays : 0, weekday: weekDays ? wd / weekDays : 0 };
}

export function lateNight(spends: Spend[], month: string) {
  const list = spends.filter((s) => s.month === month && (s.date.getHours() >= 23 || s.date.getHours() < 4));
  return { count: list.length, total: sum(list) };
}

// ---------- Size of purchases ----------
export function smallPurchases(spends: Spend[], month: string) {
  const all = spends.filter((s) => !s.recurring);
  const threshold = median(all.map((s) => s.amount));
  const cur = all.filter((s) => s.month === month && s.amount <= threshold);
  return { threshold, count: cur.length, total: sum(cur) };
}

export function averageTicket(spends: Spend[], month: string) {
  const cur = spends.filter((s) => s.month === month);
  const past = spends.filter((s) => s.month < month);
  return { now: cur.length ? sum(cur) / cur.length : 0, usual: past.length ? sum(past) / past.length : 0 };
}

// ---------- Categories ----------
export function categoryShifts(spends: Spend[], month: string, prevMonth: string, dayOfMonth: number, daysInPrev: number) {
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  for (const s of spends) {
    const k = s.categoryId ?? 'none';
    if (s.month === month) cur.set(k, (cur.get(k) ?? 0) + s.amount);
    // Same number of days into last month, so a half month compares fairly.
    if (s.month === prevMonth && s.date.getDate() <= Math.min(dayOfMonth, daysInPrev)) prev.set(k, (prev.get(k) ?? 0) + s.amount);
  }
  const keys = new Set([...cur.keys(), ...prev.keys()]);
  const shifts = [...keys].map((k) => ({ categoryId: k === 'none' ? null : k, now: cur.get(k) ?? 0, before: prev.get(k) ?? 0 }));
  const sorted = shifts.sort((a, b) => b.now - b.before - (a.now - a.before));
  return { up: sorted[0] && sorted[0].now > sorted[0].before ? sorted[0] : null, down: sorted.at(-1) && sorted.at(-1)!.now < sorted.at(-1)!.before ? sorted.at(-1)! : null };
}

export function uncategorisedShare(spends: Spend[], month: string) {
  const cur = spends.filter((s) => s.month === month);
  const total = sum(cur);
  const none = sum(cur.filter((s) => !s.categoryId));
  return total ? none / total : 0;
}

export function recurringShare(spends: Spend[], month: string) {
  const cur = spends.filter((s) => s.month === month);
  const total = sum(cur);
  return total ? sum(cur.filter((s) => s.recurring)) / total : 0;
}

// ---------- Merchants ----------
export function topMerchants(spends: Spend[], since: string, limit = 5) {
  const m = new Map<string, { name: string; total: number; count: number; first: Date; last: Date }>();
  for (const s of spends) {
    if (!s.merchant || s.key < since) continue;
    const k = s.merchant.toLowerCase();
    const cur = m.get(k) ?? { name: s.merchant, total: 0, count: 0, first: s.date, last: s.date };
    cur.total += s.amount;
    cur.count++;
    if (s.date < cur.first) cur.first = s.date;
    if (s.date > cur.last) cur.last = s.date;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

// Places you go regularly, with how often ("every 4 days").
export function habitualMerchants(spends: Spend[], since: string, limit = 5) {
  return topMerchants(spends, since, 50)
    .filter((m) => m.count >= 4)
    .map((m) => ({ ...m, every: Math.max(1, Math.round(daysBetween(m.first, m.last) / (m.count - 1))) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Average ticket at the same merchants: last 30 days vs 60–120 days ago.
export function personalInflation(spends: Spend[], now: Date): { change: number; merchants: number } | null {
  const t = now.getTime();
  const recent = new Map<string, number[]>();
  const old = new Map<string, number[]>();
  for (const s of spends) {
    if (!s.merchant || s.recurring) continue;
    const age = (t - s.date.getTime()) / 86400000;
    const k = s.merchant.toLowerCase();
    if (age <= 30) recent.set(k, [...(recent.get(k) ?? []), s.amount]);
    else if (age >= 60 && age <= 120) old.set(k, [...(old.get(k) ?? []), s.amount]);
  }
  const ratios: number[] = [];
  for (const [k, r] of recent) {
    const o = old.get(k);
    if (!o) continue;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    ratios.push(avg(r) / avg(o));
  }
  if (ratios.length < 2) return null;
  return { change: median(ratios) - 1, merchants: ratios.length };
}

// ---------- Days ----------
export function biggestDay(spends: Spend[]) {
  const byDay = new Map<string, number>();
  for (const s of spends) byDay.set(s.key, (byDay.get(s.key) ?? 0) + s.amount);
  let best: { key: string; total: number } | null = null;
  for (const [key, total] of byDay) if (!best || total > best.total) best = { key, total };
  return best;
}

// Current and longest run of days with no spending (from the first day with data).
export function noSpendStreaks(spends: Spend[], now: Date) {
  if (!spends.length) return { current: 0, longest: 0, thisMonth: 0 };
  const days = new Set(spends.filter((s) => !s.recurring).map((s) => s.key));
  const first = spends.reduce((m, s) => (s.date < m ? s.date : m), spends[0].date);
  let run = 0;
  let longest = 0;
  let thisMonth = 0;
  const month = monthKeyOf(now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let d = new Date(first.getFullYear(), first.getMonth(), first.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
    const key = localDateKey(d.toISOString());
    if (days.has(key)) run = 0;
    else {
      run++;
      longest = Math.max(longest, run);
      if (key.startsWith(month)) thisMonth++;
    }
  }
  return { current: run, longest, thisMonth };
}

export function dailyAverage(spends: Spend[], month: string, daysElapsed: number) {
  return daysElapsed ? sum(spends.filter((s) => s.month === month)) / daysElapsed : 0;
}

// Spending in the week after your biggest pay-in vs. an average week.
export function paydayEffect(spends: Spend[], incomes: { date: Date; amount: number }[], now: Date) {
  const recent = incomes.filter((i) => now.getTime() - i.date.getTime() < 120 * 86400000);
  if (!recent.length || !spends.length) return null;
  const typical = median(recent.map((i) => i.amount));
  const paydays = recent.filter((i) => i.amount >= typical * 0.8);
  let after = 0;
  for (const p of paydays) {
    const end = p.date.getTime() + 7 * 86400000;
    after += sum(spends.filter((s) => s.date >= p.date && s.date.getTime() < end && !s.recurring));
  }
  const weekAfter = after / paydays.length;
  const span = Math.max(7, daysBetween(new Date(Math.min(...spends.map((s) => s.date.getTime()))), now));
  const avgWeek = (sum(spends.filter((s) => !s.recurring)) / span) * 7;
  return avgWeek > 0 ? { weekAfter, avgWeek } : null;
}

// ---------- Income & saving ----------
export function savingStreak(txs: Transaction[], toBase: ToBase, now: Date) {
  let streak = 0;
  for (let i = 1; i <= 24; i++) {
    const m = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1));
    let inc = 0;
    let exp = 0;
    for (const t of txs) {
      if (localDateKey(t.date).slice(0, 7) !== m) continue;
      if (t.type === 'income') inc += toBase(t.amount, t.currency);
      else if (t.type === 'expense') exp += toBase(t.amount, t.currency);
    }
    if (inc === 0 && exp === 0) break;
    if (inc > exp) streak++;
    else break;
  }
  return streak;
}

export function incomeSources(txs: Transaction[], toBase: ToBase, since: string, categoryName: (id: string | null) => string) {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'income' || localDateKey(t.date) < since) continue;
    const k = t.category_id ? categoryName(t.category_id) : t.note || 'Other';
    m.set(k, (m.get(k) ?? 0) + toBase(t.amount, t.currency));
  }
  return [...m.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

export function tagTotals(txs: Transaction[], toBase: ToBase, month: string) {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'expense' || localDateKey(t.date).slice(0, 7) !== month) continue;
    for (const tag of extractTags(t.note)) m.set(tag, (m.get(tag) ?? 0) + toBase(t.amount, t.currency));
  }
  return [...m.entries()].map(([tag, total]) => ({ tag, total })).sort((a, b) => b.total - a.total);
}

export function atmStats(txs: Transaction[], accounts: Account[], toBase: ToBase, month: string) {
  const cash = new Set(accounts.filter((a) => a.type === 'cash' || a.type === 'wallet').map((a) => a.id));
  const list = txs.filter(
    (t) =>
      localDateKey(t.date).slice(0, 7) === month &&
      ((t.type === 'transfer' && t.transfer_to_account_id && cash.has(t.transfer_to_account_id)) ||
        (t.type === 'expense' && /atm|withdraw|سحب/i.test(t.note ?? '')))
  );
  const total = list.reduce((s, t) => s + toBase(t.amount, t.currency), 0);
  return { count: list.length, total, avg: list.length ? total / list.length : 0 };
}

export function foreignSpend(txs: Transaction[], base: string, toBase: ToBase, month: string) {
  const list = txs.filter(
    (t) => t.type === 'expense' && localDateKey(t.date).slice(0, 7) === month && (t.currency !== base || /\([A-Z]{3} [\d.,]+\)$/.test(t.note ?? ''))
  );
  return { count: list.length, total: list.reduce((s, t) => s + toBase(t.amount, t.currency), 0) };
}

// Year-to-date vs the same days last year.
export function yearToDate(spends: Spend[], now: Date) {
  const md = (d: Date) => d.getMonth() * 100 + d.getDate();
  const cutoff = md(now);
  const thisYear = sum(spends.filter((s) => s.date.getFullYear() === now.getFullYear()));
  const lastYearList = spends.filter((s) => s.date.getFullYear() === now.getFullYear() - 1 && md(s.date) <= cutoff);
  return { thisYear, lastYear: lastYearList.length ? sum(lastYearList) : null };
}

// Spending in the first half of the month vs the second half (per day).
export function monthHalves(spends: Spend[], months: string[]) {
  let first = 0;
  let second = 0;
  for (const s of spends) {
    if (!months.includes(s.month)) continue;
    if (s.date.getDate() <= 15) first += s.amount;
    else second += s.amount;
  }
  return { firstPerDay: first / (15 * months.length), secondPerDay: second / (15 * months.length) };
}

// ---------- Health score ----------
export interface HealthInputs {
  savingsRate: number | null; // this month or last
  budgetsOver: number;
  budgetsTotal: number;
  runwayMonths: number | null;
  creditUtilisation: number | null;
  debtToIncome: number | null; // open debt you owe ÷ monthly income
}

// 0–100: savings 30, emergency runway 25, budgets 20, credit use 15, debt 10.
export function healthScore(h: HealthInputs): { score: number; parts: { label: string; points: number; max: number }[] } {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const parts = [
    { label: 'Saving', max: 30, points: h.savingsRate === null ? 15 : 30 * clamp(h.savingsRate / 0.2) },
    { label: 'Emergency fund', max: 25, points: h.runwayMonths === null ? 12 : 25 * clamp(h.runwayMonths / 6) },
    { label: 'Budgets', max: 20, points: h.budgetsTotal ? 20 * (1 - h.budgetsOver / h.budgetsTotal) : 10 },
    { label: 'Credit use', max: 15, points: h.creditUtilisation === null ? 15 : 15 * clamp(1 - Math.max(0, h.creditUtilisation - 0.1) / 0.6) },
    { label: 'Debt', max: 10, points: h.debtToIncome === null ? 10 : 10 * clamp(1 - h.debtToIncome / 3) },
  ].map((p) => ({ ...p, points: Math.round(p.points) }));
  return { score: parts.reduce((s, p) => s + p.points, 0), parts };
}
