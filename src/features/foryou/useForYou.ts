// Gathers your data for the "For you" engine and returns what to show.
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLifeStore } from '../../store/lifeStore';
import { useHabitsStore } from '../../store/habitsStore';
import { useProductivityStore } from '../../store/productivityStore';
import { useWaterStore } from '../../store/waterStore';
import { usePersonalStore, ensurePersonalLoaded } from '../../store/personalStore';
import { useSmsStore } from '../../sms/smsStore';
import { useSpendingPlan } from '../money/plan';
import { convertToBase } from '../../db/repositories/fx';
import { listOccasions } from '../../db/repositories/occasions';
import { todayKey } from '../../db/client';
import { formatMoneyWhole } from '../../utils/money';
import { getMonthConfig, monthPeriod } from '../../utils/period';
import { daysUntilHijri, toHijri } from '../../utils/hijri';
import { daysUntilAnnual } from '../../utils/date';
import { findPrayerCity, getPrayerSchedule } from '../../utils/prayerTimes';
import { giftsToReturn, personKey } from '../../utils/gifts';
import type { BudgetStatus } from '../../utils/budgets';
import type { Occasion } from '../../db/types';
import { buildNudges, visibleNudges, type Nudge, type NudgeInput } from './engine';
import { useWealth } from '../wealth/useWealth';
import { useDebtPlan } from '../debt/useDebtPlan';

// Islamic dates far ahead are slow to search for, so they're worked out
// once per day.
const yearly = new Map<string, { eid: NudgeInput['eid']; ramadan: number | null; hawl: number | null }>();
function islamicAhead(offset: number, hawl: { month: number; day: number } | null) {
  const key = `${todayKey()}|${offset}|${hawl?.month}-${hawl?.day}`;
  let v = yearly.get(key);
  if (!v) {
    const fitr = daysUntilHijri(10, 1, offset);
    const adha = daysUntilHijri(12, 10, offset);
    const eid =
      fitr == null && adha == null
        ? null
        : (adha == null || (fitr != null && fitr <= adha))
          ? { name: 'Eid al-Fitr', daysAway: fitr! }
          : { name: 'Eid al-Adha', daysAway: adha };
    v = { eid, ramadan: daysUntilHijri(9, 1, offset), hawl: hawl ? daysUntilHijri(hawl.month, hawl.day, offset) : null };
    yearly.clear();
    yearly.set(key, v);
  }
  return v;
}

export function useForYou(budgetStatuses: Record<string, BudgetStatus> = {}, budgetNames: Record<string, string> = {}): { nudges: Nudge[]; all: Nudge[] } {
  const f = useFinanceStore(
    useShallow((s) => ({ transactions: s.transactions, accounts: s.accounts, recurringRules: s.recurringRules, savingsGoals: s.savingsGoals, debts: s.debts, fxRates: s.fxRates, categories: s.categories }))
  );
  const st = useSettingsStore(
    useShallow((s) => ({
      currency: s.currency,
      prayerCityId: s.prayerCityId,
      waterGoal: s.waterGoal,
      quranDailyGoal: s.quranDailyGoal,
      hijriOffset: s.hijriOffset,
      zakatHawl: s.zakatHawl,
      monthFromPayday: s.monthFromPayday,
      monthStartDay: s.monthStartDay,
      muted: s.forYouMuted,
      dismissed: s.forYouDismissed,
      weekStart: s.weekStart,
    }))
  );
  const life = useLifeStore(useShallow((s) => ({ prayers: s.todayPrayerLogs, journal: s.journalEntries, quranLogs: s.quranLogs })));
  const hb = useHabitsStore(useShallow((s) => ({ habits: s.habits, todayLogs: s.todayLogs, streaks: s.streaks })));
  const pr = useProductivityStore(useShallow((s) => ({ tasks: s.tasks, meetings: s.meetings })));
  const water = useWaterStore((s) => s.count);
  const personal = usePersonalStore(useShallow((s) => ({ gameya: s.gameya, gift: s.gift })));
  const pendingSms = useSmsStore((s) => s.pending.length);
  const plan = useSpendingPlan();
  const wealth = useWealth();
  const debt = useDebtPlan();
  const monthlyInvest = useSettingsStore((s) => s.monthlyInvest);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  // Re-check every couple of minutes: "Asr in 20 min" goes stale.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensurePersonalLoaded();
    listOccasions().then(setOccasions).catch(() => {});
    const t = setInterval(() => setTick((x) => x + 1), 120000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => {
    const now = new Date();
    const base = st.currency;
    const toBase = (a: number, c: string) => convertToBase(a, c, base, f.fxRates);
    const period = monthPeriod(now);
    const prevPeriod = monthPeriod(now, -1);
    const since = Math.min(prevPeriod.start.getTime(), now.getTime() - 90 * 86400000);
    const today = todayKey(now);
    const recent = f.transactions.filter((t) => new Date(t.date).getTime() >= since);
    const city = findPrayerCity(st.prayerCityId);
    const ahead = islamicAhead(st.hijriOffset, st.zakatHawl);
    const toReturn = giftsToReturn(personal.gift);
    const doneHabits = new Set(hb.todayLogs.filter((l) => l.completed).map((l) => l.habit_id));
    const upcoming = pr.meetings
      .map((m) => ({ title: m.title, start: new Date(m.start_at) }))
      .filter((m) => m.start.getTime() >= now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

    const input: NudgeInput = {
      now,
      currency: base,
      fmt: (m) => formatMoneyWhole(m, base),
      period,
      prevPeriod,
      usePaydays: st.monthFromPayday,
      paydays: getMonthConfig().paydays,
      transactions: recent.map((t) => ({ type: t.type, amount: toBase(t.amount, t.currency), note: t.note, date: t.date })),
      cards: f.accounts
        .filter((a) => a.type === 'credit' && !a.is_archived)
        .map((a) => ({
          id: a.id,
          name: a.name,
          owed: toBase(Math.max(0, -a.balance), a.currency),
          limit: toBase(a.credit_limit ?? 0, a.currency),
          dueDay: a.due_day ?? null,
          statementDay: a.statement_day ?? null,
        })),
      subscriptions: f.recurringRules
        .filter((r) => r.is_subscription && r.is_active && !r.is_paused && r.type === 'expense')
        .map((r) => ({ id: r.id, name: r.name, amount: toBase(r.amount, r.currency), due: r.next_due_date })),
      plan: plan ? { dailyLeft: plan.daily.left, monthLeft: plan.monthly.left, daysLeft: plan.daysLeft } : null,
      pendingSms,
      uncategorized: recent.filter((t) => t.type === 'expense' && !t.category_id && new Date(t.date) >= period.start).length,
      budgets: Object.entries(budgetStatuses)
        .filter(([, b]) => b.state === 'active')
        .map(([id, b]) => ({ id, name: budgetNames[id] ?? 'Budget', progress: b.progress, left: b.left })),
      goals: f.savingsGoals
        .filter((g) => !g.is_completed)
        .map((g) => ({ id: g.id, name: g.name, target: toBase(g.target_amount, g.currency), current: toBase(g.current_amount, g.currency), targetDate: g.target_date, createdAt: g.created_at })),
      prayers: {
        schedule: city ? getPrayerSchedule(city, now) : null,
        done: life.prayers.filter((p) => p.completed).map((p) => p.prayer),
      },
      hijri: toHijri(now, st.hijriOffset),
      water: { count: water, goal: st.waterGoal },
      habits: hb.habits.filter((h) => !h.is_archived).map((h) => ({ id: h.id, name: h.name, done: doneHabits.has(h.id), streak: hb.streaks[h.id] ?? 0 })),
      quran: { goal: st.quranDailyGoal, today: life.quranLogs.filter((l) => l.date === today).reduce((s, l) => s + l.pages, 0) },
      journaledToday: life.journal.some((j) => j.date === today),
      overdueTasks: pr.tasks.filter((t) => t.status !== 'done' && ((t.due_date && t.due_date < today) || (t.scheduled_date && t.scheduled_date < today))).length,
      nextMeeting: upcoming ?? null,
      occasions: occasions.map((o) => {
        const name = personKey(o.name);
        const back = toReturn.find((b) => name.includes(b.key) || b.key.includes(name));
        return { id: o.id, name: o.name, kind: o.kind, daysAway: daysUntilAnnual(o.month, o.day, now), giftBack: back?.lastReceived?.amount != null ? toBase(back.lastReceived.amount, back.lastReceived.currency) : null };
      }),
      gameyas: personal.gameya,
      hawlDaysAway: ahead.hawl,
      debtsOwedToYou: f.debts
        .filter((d) => d.direction === 'owed_to_me' && d.status !== 'paid')
        .map((d) => ({ id: d.id, person: d.person_name, remaining: toBase(d.remaining_amount, d.currency), createdAt: d.created_at })),
      eid: ahead.eid,
      ramadanDaysAway: ahead.ramadan,
      weekStart: st.weekStart,
      todayTasks: pr.tasks.filter((t) => t.status !== 'done' && t.scheduled_date === today).length,
      todayMeetings: pr.meetings.filter((m) => todayKey(new Date(m.start_at)) === today).length,
      backup: { months: wealth.backup.months, target: wealth.backup.targetMonths, monthly: wealth.backup.monthly, per12: wealth.backup.per12 },
      monthlyInvest,
      month: { income: wealth.thisMonth.income, expense: wealth.thisMonth.expense },
      debtPlan: debt.plan && debt.list.length ? { budget: debt.budget, focus: debt.list.find((d) => d.id === debt.result.focusId)?.name ?? null, months: debt.result.feasible ? debt.result.months : 0 } : null,
    };
    return buildNudges(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, st.currency, st.prayerCityId, st.waterGoal, st.quranDailyGoal, st.hijriOffset, st.zakatHawl, st.monthFromPayday, st.monthStartDay, st.weekStart, life, hb, pr, water, personal, pendingSms, plan, occasions, budgetStatuses, budgetNames, tick, wealth, monthlyInvest, debt]);

  const dayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  })();
  const nudges = useMemo(
    () => visibleNudges(all, st.muted, st.dismissed.day === dayKey ? st.dismissed.ids : []),
    [all, st.muted, st.dismissed, dayKey]
  );
  return { nudges, all };
}
