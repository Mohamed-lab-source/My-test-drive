// A plain-text report of the month so far across money, tasks, prayers,
// habits and mood — for sharing or keeping.
import { useFinanceStore } from '../store/financeStore';
import { useProductivityStore } from '../store/productivityStore';
import { useHabitsStore } from '../store/habitsStore';
import { useSettingsStore } from '../store/settingsStore';
import * as financeRepo from '../db/repositories/finance';
import * as lifeRepo from '../db/repositories/life';
import * as habitsRepo from '../db/repositories/habits';
import { listJournalEntries } from '../db/repositories/journal';
import { convertToBase } from '../db/repositories/fx';
import { todayKey } from '../db/client';
import { formatMoney } from './money';
import { localDateKey } from './date';

const MOOD_SCORE = { great: 5, good: 4, okay: 3, low: 2, rough: 1 } as const;
const MOOD_WORD = ['', 'rough', 'low', 'okay', 'good', 'great'];

export async function buildMonthlyReport(now: Date = new Date()): Promise<string> {
  const { currency } = useSettingsStore.getState();
  const { fxRates, categories } = useFinanceStore.getState();
  const { tasks } = useProductivityStore.getState();
  const { habits } = useHabitsStore.getState();
  const month = todayKey(now).slice(0, 7);
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const day = now.getDate();
  const money = (n: number) => formatMoney(Math.round(n), currency);

  const txs = await financeRepo.listTransactionsInRange(start.toISOString(), new Date(now.getTime() + 86400000).toISOString());
  let spent = 0;
  let earned = 0;
  const byCat = new Map<string, number>();
  for (const t of txs) {
    const v = convertToBase(t.amount, t.currency, currency, fxRates);
    if (t.type === 'expense') {
      spent += v;
      const name = categories.find((c) => c.id === t.category_id)?.name ?? 'Uncategorised';
      byCat.set(name, (byCat.get(name) ?? 0) + v);
    } else if (t.type === 'income') earned += v;
  }
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const done = tasks.filter((t) => t.completed_at && localDateKey(t.completed_at).startsWith(month)).length;
  const prayers = (await lifeRepo.listPrayerLogsSince(`${month}-01`)).filter((l) => l.completed).length;
  const habitLogs = await habitsRepo.listAllHabitLogsSince(`${month}-01`);
  const habitRate = habits.length ? habitLogs.length / (habits.length * day) : null;
  const journal = (await listJournalEntries(31)).filter((e) => e.date.startsWith(month));
  const mood = journal.length ? journal.reduce((s, e) => s + MOOD_SCORE[e.mood], 0) / journal.length : null;

  return [
    `Anchor — ${now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} (day ${day})`,
    '',
    '💰 Money',
    `Spent ${money(spent)} · earned ${money(earned)} · net ${money(earned - spent)}`,
    ...topCats.map(([name, v]) => `  • ${name}: ${money(v)}`),
    '',
    '✅ Tasks',
    `${done} completed`,
    '',
    '🕌 Prayers',
    `${prayers} of ${day * 5} logged (${Math.round((prayers / (day * 5)) * 100)}%)`,
    habitRate !== null ? `\n🎯 Habits\n${Math.round(habitRate * 100)}% of daily habits done` : null,
    mood !== null ? `\n😊 Mood\nMostly ${MOOD_WORD[Math.round(mood)]} (${journal.length} check-ins)` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
