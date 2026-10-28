// Sample data for the web design preview only (see auth/backend.web.ts), so
// screens can be checked with realistic content. Never runs on a phone.
import * as finance from '../db/repositories/finance';
import * as productivity from '../db/repositories/productivity';
import * as life from '../db/repositories/life';
import { setWater } from '../db/repositories/health';
import { todayKey } from '../db/client';
import { useSettingsStore } from '../store/settingsStore';

export async function seedPreviewData(): Promise<void> {
  if ((await finance.listAccounts()).length > 0) return;
  useSettingsStore.getState().setCurrency('EGP');
  const day = (n: number, h = 13) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(h, 20, 0, 0);
    return d.toISOString();
  };
  const bank = await finance.createAccount({ name: 'HSBC Current', type: 'bank', currency: 'EGP', icon: 'building.columns.fill', color: '#DB0011', sort_order: 0, balance: 4825000 });
  const card = await finance.createAccount({ name: 'CIB Credit Card ••4521', type: 'credit', currency: 'EGP', icon: 'creditcard.fill', color: '#1C3F94', sort_order: 1, balance: -1240000, credit_limit: 5000000 });
  await finance.createAccount({ name: 'Savings', type: 'savings', currency: 'EGP', icon: 'banknote.fill', color: '#34C759', sort_order: 2, balance: 12000000 });
  await finance.createAccount({ name: 'Cash', type: 'cash', currency: 'EGP', icon: 'wallet.pass.fill', color: '#FF9500', sort_order: 3, balance: 185000 });
  const cats = await finance.listCategories();
  const cat = (re: RegExp) => cats.find((c) => re.test(c.name))?.id ?? null;
  const spends: [number, number, string, RegExp, string][] = [
    [0, 12550, 'Uber', /transport/i, card],
    [0, 8500, 'Starbucks', /food|dining|restaurant/i, card],
    [1, 245000, 'Carrefour', /grocer/i, bank],
    [2, 19900, 'Netflix', /entertain|subscri/i, card],
    [3, 64000, 'Talabat', /food|dining|restaurant/i, card],
    [5, 150000, 'Vodafone', /bill|util/i, bank],
    [8, 98000, 'IKEA', /shop|home/i, card],
    [11, 31000, 'Seoudi', /grocer/i, bank],
  ];
  for (const [n, amount, note, re, account] of spends) {
    await finance.createTransaction({ type: 'expense', amount, currency: 'EGP', account_id: account, transfer_to_account_id: null, category_id: cat(re), recurring_id: null, note, date: day(n) });
  }
  for (const n of [9, 40, 71]) {
    await finance.createTransaction({ type: 'income', amount: 4500000, currency: 'EGP', account_id: bank, transfer_to_account_id: null, category_id: cat(/salary/i), recurring_id: null, note: 'Salary', date: day(n, 9) });
  }
  await finance.updateAccount(card, { apr: 36, min_payment_pct: 5, statement_day: 25, due_day: 15, card_last4: '4521', monthly_limit: 2000000 });
  await finance.updateAccount(bank, { monthly_limit: 1500000, card_last4: '0131' });
  // Budgets of different shapes, to show what they can do.
  const food = cat(/food|dining|restaurant/i);
  const groceries = cat(/grocer/i);
  const later = todayKey(new Date(Date.now() + 10 * 86400000));
  const end = todayKey(new Date(Date.now() + 16 * 86400000));
  for (const b of [
    { name: null, category_id: food, category_ids: JSON.stringify([food]), monthly_limit: 300000, period: 'monthly' as const, icon: 'fork.knife', color: '#FF9500' },
    { name: 'Groceries', category_id: groceries, category_ids: JSON.stringify([groceries]), monthly_limit: 250000, period: 'monthly' as const, rollover: 1, icon: 'cart.fill', color: '#34C759' },
    { name: 'CIB card', category_id: null, account_ids: JSON.stringify([card]), monthly_limit: 150000, period: 'weekly' as const, icon: 'creditcard.fill', color: '#1C3F94', include_bills: 0 },
    { name: 'Coffee', category_id: null, keywords: 'starbucks, costa', monthly_limit: 10000, period: 'daily' as const, icon: 'sparkles', color: '#A2845E', alert_pct: 0 },
    { name: 'Hurghada trip', category_id: null, monthly_limit: 1200000, period: 'custom' as const, start_date: later, end_date: end, icon: 'airplane', color: '#5856D6', notes: 'Hotel is prepaid — this is for food and trips' },
  ]) {
    await finance.createBudget({ currency: 'EGP', ...b });
  }
  await finance.createSavingsGoal({ name: 'Umrah trip', target_amount: 9000000, currency: 'EGP', target_date: null, icon: 'airplane', color: '#5856D6', notes: null });
  const t = todayKey();
  const tasks: [string, Task['priority'], string | null, Task['status']][] = [
    ['Call the bank about the card limit', 'high', t, 'todo'],
    ['Prepare Monday team update', 'medium', t, 'todo'],
    ['Book dentist appointment', 'low', t, 'done'],
    ['Renew car licence', 'medium', null, 'todo'],
  ];
  for (const [i, [title, priority, scheduled, status]] of tasks.entries()) {
    await productivity.createTask({ project_id: null, title, notes: null, status, priority, due_date: null, scheduled_date: scheduled, sort_order: i, completed_at: status === 'done' ? new Date().toISOString() : null });
  }
  await life.setPrayerLog(t, 'fajr', true);
  await life.setPrayerLog(t, 'dhuhr', true);
  await life.setPrayerLog(t, 'asr', true);
  await setWater(t, 5);
}

type Task = import('../db/types').Task;
