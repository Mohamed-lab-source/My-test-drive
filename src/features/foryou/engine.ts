// "For you": the few things that matter to you right now, picked from your
// own money, cards, prayers, habits, tasks and occasions. Pure — the hook in
// useForYou.ts gathers the data; this decides what to say.
import { gameyaStatus, daysUntilDue, gameyaPot, type Gameya } from '../../utils/gameya';

export type NudgeTone = 'red' | 'orange' | 'blue' | 'green' | 'purple' | 'teal' | 'indigo';

export interface Nudge {
  // Stable per thing and day, so it can be dismissed for today.
  id: string;
  // The kind, so a whole kind can be turned off.
  kind: NudgeKind;
  emoji: string;
  title: string;
  detail: string;
  route: string | null;
  // Higher shows first.
  priority: number;
  tone: NudgeTone;
}

export const NUDGE_KINDS = {
  payday: 'Salary day',
  salaryLate: 'Late salary',
  nextPayday: 'Days to payday',
  cardDue: 'Card payment due',
  cardHigh: 'Card near its limit',
  statement: 'Card statement closing',
  rides: 'Rides',
  delivery: 'Food delivery',
  coffee: 'Coffee',
  subscription: 'Subscriptions renewing',
  bigCharge: 'Unusually big charges',
  overToday: "Over today's limit",
  sms: 'Bank SMS to review',
  uncategorized: 'Uncategorized spending',
  budget: 'Budgets running out',
  goalBehind: 'Savings goals behind',
  umrah: 'Umrah / Hajj fund',
  nextPrayer: 'Next prayer',
  missedPrayer: 'Prayers not marked',
  kahf: "Surat Al-Kahf on Friday",
  sunnahFast: 'Monday & Thursday fasts',
  whiteDays: 'White days',
  water: 'Water',
  habits: 'Habits left today',
  streak: 'Streaks at risk',
  overdue: 'Overdue tasks',
  meeting: 'Meetings soon',
  occasion: 'Birthdays & occasions',
  giftBack: 'Gifts to return',
  gameya: "Gam'eya",
  hawl: 'Zakat year',
  weekend: 'Weekend planning',
  lateNight: 'Late-night spending',
  owedToYou: 'Money owed to you',
  quran: 'Quran daily goal',
  journal: 'Journal',
  eid: 'Eid & Eidiya',
  ramadan: 'Ramadan coming',
  bestCard: 'Best card to use',
  weekRecap: 'Weekly spending recap',
  noSpend: 'No-spend days',
  duplicate: 'Possible double charges',
  morning: 'Morning summary',
  backup: 'Backup money',
  invest: 'Monthly investing',
  overspend: 'Spending more than you earn',
  debtPlan: 'Debt plan payments',
} as const;
export type NudgeKind = keyof typeof NUDGE_KINDS;

type Prayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
const PRAYER_NAME: Record<Prayer, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

export interface NudgeTx {
  type: 'income' | 'expense' | 'transfer';
  // Already in your main currency.
  amount: number;
  note: string | null;
  date: string;
}

export interface NudgeCard {
  id: string;
  name: string;
  owed: number;
  limit: number;
  dueDay: number | null;
  statementDay: number | null;
}

export interface NudgeInput {
  now: Date;
  currency: string;
  fmt: (minor: number) => string;
  // This money month and the one before.
  period: { start: Date; end: Date };
  prevPeriod: { start: Date; end: Date };
  usePaydays: boolean;
  paydays: number[];
  transactions: NudgeTx[];
  cards: NudgeCard[];
  subscriptions: { id: string; name: string; amount: number; due: string }[];
  plan: { dailyLeft: number; monthLeft: number; daysLeft: number } | null;
  pendingSms: number;
  uncategorized: number;
  budgets: { id: string; name: string; progress: number; left: number }[];
  goals: { id: string; name: string; target: number; current: number; targetDate: string | null; createdAt: string }[];
  prayers: { schedule: Record<Prayer, Date> | null; done: Prayer[] };
  hijri: { day: number; month: number };
  water: { count: number; goal: number };
  habits: { id: string; name: string; done: boolean; streak: number }[];
  quran: { goal: number; today: number };
  journaledToday: boolean;
  overdueTasks: number;
  nextMeeting: { title: string; start: Date } | null;
  occasions: { id: string; name: string; kind: string; daysAway: number; giftBack: number | null }[];
  gameyas: (Gameya & { id: string })[];
  hawlDaysAway: number | null;
  debtsOwedToYou: { id: string; person: string; remaining: number; createdAt: string }[];
  eid: { name: string; daysAway: number } | null;
  ramadanDaysAway: number | null;
  // 0 = Sunday … 6 = Saturday.
  weekStart: number;
  todayTasks: number;
  todayMeetings: number;
  // Backup money in months of spending, and the target.
  backup?: { months: number; target: number; monthly: number; per12: number } | null;
  monthlyInvest?: number;
  // This money month so far.
  month?: { income: number; expense: number };
  // Your debt plan: this month's total and the focus debt.
  debtPlan?: { budget: number; focus: string | null; months: number } | null;
}

const DAY = 86400000;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

// Next date with this day of the month, from today (clamped to short months).
function nextDayOfMonth(now: Date, day: number): Date {
  const today = startOfDay(now);
  const at = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  const thisMonth = at(today.getFullYear(), today.getMonth());
  return thisMonth >= today ? thisMonth : at(today.getFullYear(), today.getMonth() + 1);
}

const RIDES = /uber|careem|indrive|in drive|didi|swvl|bolt|halan/i;
const DELIVERY = /talabat|elmenus|breadfast|rabbit|instashop|noon food|uber\s*eats|mrsool|deliveroo|طلبات/i;
const COFFEE = /starbucks|costa|cilantro|dunkin|tim hortons|caribou|beanos|espresso lab|coffee|كافيه|قهوة/i;

function spendMatching(txs: NudgeTx[], re: RegExp, from: Date, to: Date): { sum: number; count: number } {
  let sum = 0;
  let count = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !t.note || !re.test(t.note)) continue;
    const at = new Date(t.date).getTime();
    if (at < from.getTime() || at >= to.getTime()) continue;
    sum += t.amount;
    count++;
  }
  return { sum, count };
}

export function buildNudges(i: NudgeInput): Nudge[] {
  const out: Nudge[] = [];
  const { now, fmt } = i;
  const today = startOfDay(now);
  const hour = now.getHours() + now.getMinutes() / 60;
  const dk = dayKey(now);
  const push = (n: Omit<Nudge, 'id'> & { key?: string }) => out.push({ ...n, id: `${n.kind}:${n.key ?? ''}:${dk}` });

  // ---- Salary
  const lastPayday = i.paydays.length ? new Date(i.paydays[i.paydays.length - 1]) : null;
  if (lastPayday && startOfDay(lastPayday).getTime() === today.getTime()) {
    push({ kind: 'payday', emoji: '💰', title: 'Your salary arrived', detail: 'Run the payday checklist: cards, savings, sadaqah and the rest.', route: '/money/payday', priority: 100, tone: 'green' });
  }
  if (i.usePaydays && lastPayday) {
    const expected = new Date(lastPayday.getFullYear(), lastPayday.getMonth() + 1, lastPayday.getDate());
    const late = Math.floor((today.getTime() - expected.getTime()) / DAY);
    if (late >= 2) {
      push({ kind: 'salaryLate', emoji: '⏳', title: `Salary is ${plural(late, 'day')} late`, detail: 'This month stays open until it arrives, so your budgets keep running.', route: '/money/plan', priority: 60, tone: 'orange' });
    }
  }
  {
    const next = startOfDay(i.period.end);
    const days = Math.round((next.getTime() - today.getTime()) / DAY);
    if (days >= 1 && days <= 7) {
      const per = i.plan && i.plan.daysLeft > 0 ? Math.max(0, i.plan.monthLeft) / Math.max(1, days) : null;
      push({
        kind: 'nextPayday',
        emoji: '🗓️',
        title: `Next month starts ${inDays(days)}`,
        detail: per != null ? `${fmt(per)} a day until then.` : 'Your budgets reset then.',
        route: '/money/plan',
        priority: 25,
        tone: 'blue',
      });
    }
  }

  // ---- Cards
  for (const c of i.cards) {
    if (c.owed > 0 && c.dueDay) {
      const due = nextDayOfMonth(now, c.dueDay);
      const days = Math.round((due.getTime() - today.getTime()) / DAY);
      if (days <= 5) {
        push({ kind: 'cardDue', key: c.id, emoji: '💳', title: `${c.name}: payment due ${inDays(days)}`, detail: `${fmt(c.owed)} owed. Pay it to avoid interest.`, route: `/money/account/${c.id}`, priority: 90 - days, tone: days <= 1 ? 'red' : 'orange' });
      }
    }
    if (c.limit > 0 && c.owed / c.limit >= 0.7) {
      push({ kind: 'cardHigh', key: c.id, emoji: '📈', title: `${c.name} is ${Math.round((c.owed / c.limit) * 100)}% used`, detail: `${fmt(Math.max(0, c.limit - c.owed))} left on the card.`, route: `/money/account/${c.id}`, priority: 55, tone: 'orange' });
    }
    if (c.statementDay) {
      const close = nextDayOfMonth(now, c.statementDay);
      const days = Math.round((close.getTime() - today.getTime()) / DAY);
      if (days >= 0 && days <= 2) {
        push({ kind: 'statement', key: c.id, emoji: '🧾', title: `${c.name} statement closes ${inDays(days)}`, detail: 'Big purchases after that land on next month’s bill.', route: `/money/account/${c.id}`, priority: 30, tone: 'indigo' });
      }
    }
  }

  // ---- Spending habits: this money month so far vs the same days last month.
  const elapsed = now.getTime() - i.period.start.getTime();
  const prevTo = new Date(i.prevPeriod.start.getTime() + elapsed);
  for (const [kind, re, emoji, word, route] of [
    ['rides', RIDES, '🚕', 'Rides', '/money/insights'],
    ['delivery', DELIVERY, '🛵', 'Food delivery', '/money/insights'],
  ] as const) {
    const cur = spendMatching(i.transactions, re, i.period.start, now);
    const prev = spendMatching(i.transactions, re, i.prevPeriod.start, prevTo);
    if (cur.count >= 2 && cur.sum > prev.sum * 1.25 && cur.sum - prev.sum > 0) {
      const up = prev.sum > 0 ? `${Math.round(((cur.sum - prev.sum) / prev.sum) * 100)}% more than` : 'up from nothing';
      push({ kind, emoji, title: `${word}: ${fmt(cur.sum)} this month`, detail: `${plural(cur.count, 'order')} — ${up} by this point last month.`, route, priority: 40, tone: 'orange' });
    }
  }
  {
    const cur = spendMatching(i.transactions, COFFEE, i.period.start, now);
    if (cur.count >= 4) {
      push({ kind: 'coffee', emoji: '☕', title: `${cur.count} coffees this month`, detail: `${fmt(cur.sum)} so far — about ${fmt(cur.sum / cur.count)} each.`, route: '/money/insights', priority: 15, tone: 'teal' });
    }
  }
  for (const s of i.subscriptions) {
    const days = Math.round((startOfDay(new Date(s.due)).getTime() - today.getTime()) / DAY);
    if (days >= 0 && days <= 3) {
      push({ kind: 'subscription', key: s.id, emoji: '🔁', title: `${s.name} renews ${inDays(days)}`, detail: `${fmt(s.amount)}. Still using it?`, route: '/money/subscriptions', priority: 45, tone: 'purple' });
    }
  }
  {
    const expenses = i.transactions.filter((t) => t.type === 'expense' && now.getTime() - new Date(t.date).getTime() < 90 * DAY);
    const sorted = expenses.map((t) => t.amount).sort((a, b) => a - b);
    const median = sorted.length >= 10 ? sorted[Math.floor(sorted.length / 2)] : 0;
    const recent = expenses.filter((t) => now.getTime() - new Date(t.date).getTime() < 3 * DAY && median > 0 && t.amount >= median * 4 && t.amount >= 50000);
    const big = recent.sort((a, b) => b.amount - a.amount)[0];
    if (big) {
      push({ kind: 'bigCharge', emoji: '🔎', title: `Big charge: ${fmt(big.amount)}`, detail: `${big.note ?? 'A purchase'} — about ${Math.round(big.amount / median)}× your usual. Was it you?`, route: '/money/transactions', priority: 65, tone: 'red' });
    }
  }
  {
    const late = i.transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d >= i.period.start && d <= now && d.getHours() < 4;
    });
    if (late.length >= 3) {
      push({ kind: 'lateNight', emoji: '🌃', title: `${late.length} late-night purchases this month`, detail: `${fmt(late.reduce((s, t) => s + t.amount, 0))} spent between midnight and 4am.`, route: '/money/transactions', priority: 12, tone: 'indigo' });
    }
  }
  if (i.plan && i.plan.dailyLeft < 0) {
    push({ kind: 'overToday', emoji: '🛑', title: `${fmt(-i.plan.dailyLeft)} over today's limit`, detail: 'Taking it easy for the rest of the day keeps the month on track.', route: '/money/plan', priority: 70, tone: 'red' });
  }
  if (i.pendingSms > 0) {
    push({ kind: 'sms', emoji: '✉️', title: `${plural(i.pendingSms, 'bank alert')} to review`, detail: 'Add them in a tap so your totals stay right.', route: '/money/sms-inbox', priority: 50, tone: 'blue' });
  }
  if (i.uncategorized >= 5) {
    push({ kind: 'uncategorized', emoji: '🏷️', title: `${i.uncategorized} purchases without a category`, detail: 'Sorting them makes your budgets and insights accurate.', route: '/money/uncategorized', priority: 18, tone: 'teal' });
  }
  for (const b of i.budgets) {
    if (b.progress >= 0.9) {
      push({ kind: 'budget', key: b.id, emoji: b.progress >= 1 ? '🚨' : '⚠️', title: b.progress >= 1 ? `${b.name} budget is used up` : `${b.name}: ${Math.round(b.progress * 100)}% used`, detail: b.left > 0 ? `${fmt(b.left)} left.` : `${fmt(-b.left)} over.`, route: '/money/budgets', priority: b.progress >= 1 ? 58 : 48, tone: b.progress >= 1 ? 'red' : 'orange' });
    }
  }
  for (const g of i.goals) {
    const sacred = /umrah|hajj|عمرة|عمره|حج/i.test(g.name);
    if (sacred && g.target > 0) {
      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      push({ kind: 'umrah', key: g.id, emoji: '🕋', title: `${g.name}: ${pct}% saved`, detail: `${fmt(Math.max(0, g.target - g.current))} to go. May Allah make it easy.`, route: '/money/savings', priority: 20, tone: 'green' });
    }
    if (g.targetDate && g.target > g.current) {
      const start = new Date(g.createdAt).getTime();
      const end = new Date(g.targetDate).getTime();
      if (end > start && now.getTime() > start) {
        const expected = g.target * Math.min(1, (now.getTime() - start) / (end - start));
        if (g.current < expected * 0.8 && expected - g.current > 0) {
          const months = Math.max(1, Math.round((end - now.getTime()) / (30 * DAY)));
          push({ kind: 'goalBehind', key: g.id, emoji: '🎯', title: `${g.name} is behind`, detail: `Save ${fmt((g.target - g.current) / months)} a month to reach it on time.`, route: '/money/savings', priority: 28, tone: 'orange' });
        }
      }
    }
  }
  for (const d of i.debtsOwedToYou) {
    const days = Math.floor((now.getTime() - new Date(d.createdAt).getTime()) / DAY);
    if (d.remaining > 0 && days >= 30) {
      push({ kind: 'owedToYou', key: d.id, emoji: '🤝', title: `${d.person} owes you ${fmt(d.remaining)}`, detail: `For ${days} days now. A gentle reminder?`, route: '/money/debts', priority: 22, tone: 'indigo' });
    }
  }
  for (const g of i.gameyas) {
    const st = gameyaStatus(g, now);
    if (st.nextMine && st.nextMine.monthsAway === 0) {
      push({ kind: 'gameya', key: `${g.id}-turn`, emoji: '🎉', title: `It's your turn in ${g.name}`, detail: `You take ${fmt(gameyaPot(g))} this month.`, route: '/money/gameya', priority: 75, tone: 'green' });
    }
    if (st.dueNow) {
      const days = daysUntilDue(g, now);
      if (days <= 5) {
        push({ kind: 'gameya', key: g.id, emoji: '🤝', title: `${g.name}: pay your share ${days < 0 ? 'now' : inDays(days)}`, detail: `${fmt(g.share)}${st.current?.name ? ` — ${st.current.name} takes it this month` : ''}.`, route: '/money/gameya', priority: days < 0 ? 80 : 62, tone: days < 0 ? 'red' : 'orange' });
      }
    }
  }
  if (i.hawlDaysAway != null && i.hawlDaysAway <= 30) {
    push({ kind: 'hawl', emoji: '🌙', title: `Your zakat year completes ${inDays(i.hawlDaysAway)}`, detail: 'Work out what you owe on savings and gold.', route: '/money/zakat', priority: 35, tone: 'green' });
  }

  // ---- Prayer and worship
  const sched = i.prayers.schedule;
  if (sched) {
    const order: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const next = order.find((p) => sched[p].getTime() > now.getTime());
    if (next) {
      const mins = Math.round((sched[next].getTime() - now.getTime()) / 60000);
      if (mins <= 30) push({ kind: 'nextPrayer', emoji: '🕌', title: `${PRAYER_NAME[next]} in ${mins} min`, detail: 'Time to wrap up and make wudu.', route: '/life/prayer-times', priority: 85, tone: 'teal' });
    }
    // A prayer counts as missed-to-mark once the next one has started.
    const missed = order.filter((p, k) => !i.prayers.done.includes(p) && (k < order.length - 1 ? sched[order[k + 1]].getTime() <= now.getTime() : false));
    if (missed.length) {
      push({ kind: 'missedPrayer', emoji: '🤲', title: `${missed.map((p) => PRAYER_NAME[p]).join(', ')} not marked`, detail: 'Mark what you prayed, or plan to make it up.', route: '/life', priority: 52, tone: 'indigo' });
    }
    if (now.getDay() === 5 && now.getTime() < sched.maghrib.getTime()) {
      push({ kind: 'kahf', emoji: '📖', title: "It's Friday — Surat Al-Kahf", detail: 'Read it before Maghrib, and send salawat on the Prophet ﷺ.', route: '/life/quran', priority: 42, tone: 'green' });
    }
  }
  const tomorrow = new Date(today.getTime() + DAY);
  if (hour >= 17 && (tomorrow.getDay() === 1 || tomorrow.getDay() === 4) && !(i.ramadanDaysAway === 0)) {
    push({ kind: 'sunnahFast', emoji: '🌤️', title: `Fast tomorrow? It's ${tomorrow.getDay() === 1 ? 'Monday' : 'Thursday'}`, detail: 'A Sunnah fast. Set an alarm for suhoor.', route: '/life/fasting', priority: 20, tone: 'teal' });
  }
  if (hour >= 17 && i.hijri.day >= 12 && i.hijri.day <= 14 && i.hijri.month !== 9) {
    push({ kind: 'whiteDays', emoji: '🌕', title: `Tomorrow is White Day ${i.hijri.day + 1}`, detail: 'The 13th, 14th and 15th of the Hijri month are recommended fasts.', route: '/life/fasting', priority: 21, tone: 'teal' });
  }
  if (i.quran.goal > 0 && i.quran.today < i.quran.goal && hour >= 20) {
    push({ kind: 'quran', emoji: '📗', title: `${plural(i.quran.goal - i.quran.today, 'page')} left of today's Quran`, detail: 'A few minutes before sleep finishes it.', route: '/life/quran', priority: 32, tone: 'green' });
  }
  if (i.eid && i.eid.daysAway >= 0 && i.eid.daysAway <= 14) {
    push({ kind: 'eid', emoji: '🌙', title: `${i.eid.name} ${inDays(i.eid.daysAway)}`, detail: 'Plan the Eidiya and get new notes from the bank in time.', route: '/life/eidiya', priority: 44, tone: 'purple' });
  }
  if (i.ramadanDaysAway != null && i.ramadanDaysAway > 0 && i.ramadanDaysAway <= 30) {
    push({ kind: 'ramadan', emoji: '🏮', title: `Ramadan ${inDays(i.ramadanDaysAway)}`, detail: 'Set a Ramadan budget and a khatm goal now.', route: '/money/tools', priority: 38, tone: 'purple' });
  }

  // ---- Health and habits
  if (i.water.goal > 0 && hour >= 11 && hour < 22) {
    const expected = Math.floor(i.water.goal * Math.min(1, (hour - 8) / 14));
    if (i.water.count <= expected - 2) {
      push({ kind: 'water', emoji: '💧', title: `${i.water.count} of ${i.water.goal} glasses so far`, detail: `You'd usually be at ${expected} by now. Have a glass.`, route: '/life/health', priority: 26, tone: 'blue' });
    }
  }
  if (hour >= 19) {
    const left = i.habits.filter((h) => !h.done);
    const risky = left.filter((h) => h.streak >= 5).sort((a, b) => b.streak - a.streak);
    if (risky.length) {
      push({ kind: 'streak', emoji: '🔥', title: `Keep your ${risky[0].streak}-day ${risky[0].name} streak`, detail: risky.length > 1 ? `${risky.length - 1} other streak${risky.length > 2 ? 's' : ''} also need today.` : 'Still time today.', route: '/life/habits', priority: 46, tone: 'orange' });
    } else if (left.length) {
      push({ kind: 'habits', emoji: '✅', title: `${plural(left.length, 'habit')} left today`, detail: left.slice(0, 3).map((h) => h.name).join(', '), route: '/life/habits', priority: 24, tone: 'green' });
    }
  }
  if (!i.journaledToday && hour >= 21) {
    push({ kind: 'journal', emoji: '📝', title: 'How was today?', detail: 'One line for the journal, and something you’re grateful for.', route: '/life/journal', priority: 14, tone: 'indigo' });
  }

  // ---- Tasks and people
  if (i.overdueTasks > 0) {
    push({ kind: 'overdue', emoji: '⏰', title: `${plural(i.overdueTasks, 'task')} overdue`, detail: 'Do one, move the rest to a day that works.', route: '/tasks', priority: 47, tone: 'red' });
  }
  if (i.nextMeeting) {
    const mins = Math.round((i.nextMeeting.start.getTime() - now.getTime()) / 60000);
    if (mins >= 0 && mins <= 60) push({ kind: 'meeting', emoji: '📅', title: `${i.nextMeeting.title} in ${mins} min`, detail: 'Check your notes before it starts.', route: '/tasks/meetings', priority: 88, tone: 'blue' });
  }
  for (const o of i.occasions) {
    if (o.daysAway > 7) continue;
    const what = o.kind === 'birthday' ? 'birthday' : o.kind === 'anniversary' ? 'anniversary' : '';
    push({
      kind: 'occasion',
      key: o.id,
      emoji: o.kind === 'birthday' ? '🎂' : o.kind === 'anniversary' ? '💍' : '🎉',
      title: `${o.name}${what ? `'s ${what}` : ''} ${inDays(o.daysAway)}`,
      detail: o.giftBack ? `Last time they gave you ${fmt(o.giftBack)}.` : 'Plan a gift or a call.',
      route: '/life/gifts',
      priority: o.daysAway <= 1 ? 66 : 36,
      tone: 'purple',
    });
    if (o.giftBack) {
      push({ kind: 'giftBack', key: o.id, emoji: '🎁', title: `Return ${o.name}'s gift`, detail: `They gave you ${fmt(o.giftBack)} — this is a good time to give back.`, route: '/life/gifts', priority: 34, tone: 'purple' });
    }
  }
  if (now.getDay() === 4 && hour >= 16) {
    push({ kind: 'weekend', emoji: '🌴', title: 'The weekend starts tomorrow', detail: 'Pick what you want to get done — and what to leave for Sunday.', route: '/tasks', priority: 16, tone: 'teal' });
  }

  // ---- A few more about your money and your day
  {
    // The card whose statement closed most recently gives the longest
    // interest-free time for a purchase today.
    const withCycle = i.cards.filter((c) => c.statementDay && c.limit - c.owed > 0);
    if (withCycle.length >= 2) {
      const sinceClose = (c: NudgeCard) => {
        const close = nextDayOfMonth(new Date(today.getTime() - 31 * DAY), c.statementDay!);
        let last = close;
        while (true) {
          const nxt = nextDayOfMonth(new Date(last.getTime() + DAY), c.statementDay!);
          if (nxt.getTime() > today.getTime()) break;
          last = nxt;
        }
        return Math.round((today.getTime() - last.getTime()) / DAY);
      };
      const best = [...withCycle].sort((a, b) => sinceClose(a) - sinceClose(b))[0];
      if (sinceClose(best) <= 3) {
        push({ kind: 'bestCard', key: best.id, emoji: '🏆', title: `Use ${best.name} for big buys`, detail: 'Its statement just closed, so purchases now have the longest time before you pay.', route: '/money/limits', priority: 19, tone: 'indigo' });
      }
    }
  }
  if (now.getDay() === i.weekStart && hour < 14) {
    const weekAgo = new Date(today.getTime() - 7 * DAY);
    const twoWeeks = new Date(today.getTime() - 14 * DAY);
    const spent = (from: Date, to: Date) => i.transactions.filter((t) => t.type === 'expense' && new Date(t.date) >= from && new Date(t.date) < to).reduce((s, t) => s + t.amount, 0);
    const last = spent(weekAgo, today);
    const before = spent(twoWeeks, weekAgo);
    if (last > 0) {
      const change = before > 0 ? Math.round(((last - before) / before) * 100) : null;
      push({ kind: 'weekRecap', emoji: '📊', title: `Last week: ${fmt(last)}`, detail: change == null ? 'A new week starts today.' : change === 0 ? 'The same as the week before.' : `${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} than the week before.`, route: '/money/analytics', priority: 23, tone: change != null && change > 15 ? 'orange' : 'green' });
    }
  }
  if (hour >= 20 && i.transactions.length > 0) {
    const spentToday = i.transactions.some((t) => t.type === 'expense' && new Date(t.date) >= today);
    if (!spentToday) push({ kind: 'noSpend', emoji: '🌱', title: 'A no-spend day', detail: 'Nothing spent today. That’s money kept for what matters.', route: null, priority: 10, tone: 'green' });
  }
  {
    // The same amount at the same place twice within ten minutes.
    const recent = i.transactions
      .filter((t) => t.type === 'expense' && now.getTime() - new Date(t.date).getTime() < 3 * DAY)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let k = 1; k < recent.length; k++) {
      const a = recent[k - 1];
      const b = recent[k];
      if (a.amount === b.amount && a.note && a.note === b.note && new Date(b.date).getTime() - new Date(a.date).getTime() <= 10 * 60000) {
        push({ kind: 'duplicate', key: b.date, emoji: '👯', title: `Charged twice at ${a.note}?`, detail: `${fmt(a.amount)} twice within minutes. Check with the bank if it wasn't you.`, route: '/money/transactions', priority: 64, tone: 'red' });
        break;
      }
    }
  }
  if (hour >= 5 && hour < 11 && (i.todayTasks || i.todayMeetings || i.plan)) {
    const bits = [
      i.todayTasks ? plural(i.todayTasks, 'task') : null,
      i.todayMeetings ? plural(i.todayMeetings, 'meeting') : null,
      i.plan && i.plan.dailyLeft > 0 ? `${fmt(i.plan.dailyLeft)} to spend` : null,
    ].filter(Boolean);
    if (bits.length) push({ kind: 'morning', emoji: '☀️', title: 'Your day', detail: `${bits.join(' · ')}. Bismillah.`, route: '/tasks', priority: 27, tone: 'orange' });
  }

  if (i.debtPlan && i.debtPlan.budget > 0 && lastPayday && startOfDay(lastPayday).getTime() === today.getTime()) {
    push({
      kind: 'debtPlan',
      emoji: '🎯',
      title: `Pay ${fmt(i.debtPlan.budget)} toward your debts`,
      detail: `${i.debtPlan.focus ? `Focus on ${i.debtPlan.focus}. ` : ''}${i.debtPlan.months ? `Debt-free in ${i.debtPlan.months} month${i.debtPlan.months === 1 ? '' : 's'} at this pace.` : ''}`,
      route: '/money/debt-plan',
      priority: 78,
      tone: 'green',
    });
  }
  // ---- Saving, backup money and investing
  if (i.backup && i.backup.monthly > 0 && i.backup.months < i.backup.target) {
    const m = i.backup.months;
    const words = m < 1 ? `${Math.max(0, Math.round(m * 4.3))} weeks` : `${m.toFixed(1)} months`;
    push({
      kind: 'backup',
      emoji: '🛟',
      title: m < 1 ? `Your backup money covers ${words}` : `Backup: ${words} of ${i.backup.target}`,
      detail: m < 1 ? `Get to one month first — ${fmt(i.backup.monthly)}. Then keep going.` : `${fmt(i.backup.per12)} a month fills it within a year.`,
      route: '/money/wealth?tab=backup',
      priority: m < 1 ? 49 : 17,
      tone: m < 1 ? 'orange' : 'blue',
    });
  }
  if (i.monthlyInvest && i.monthlyInvest > 0 && lastPayday && startOfDay(lastPayday).getTime() === today.getTime()) {
    push({ kind: 'invest', emoji: '📈', title: `Invest ${fmt(i.monthlyInvest)} this month`, detail: 'See how to split it across your mix.', route: '/money/wealth?tab=invest', priority: 72, tone: 'green' });
  }
  if (i.month && i.month.income > 0 && i.month.expense > i.month.income) {
    const elapsed = (now.getTime() - i.period.start.getTime()) / Math.max(1, i.period.end.getTime() - i.period.start.getTime());
    if (elapsed >= 0.4) {
      push({ kind: 'overspend', emoji: '⚠️', title: 'Spending more than you earned', detail: `${fmt(i.month.expense - i.month.income)} over this month's income so far. Slow down to protect your savings.`, route: '/money/wealth?tab=save', priority: 53, tone: 'red' });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}

// Without what you've turned off or dismissed today.
export function visibleNudges(all: Nudge[], muted: string[], dismissed: string[]): Nudge[] {
  return all.filter((n) => !muted.includes(n.kind) && !dismissed.includes(n.id));
}
