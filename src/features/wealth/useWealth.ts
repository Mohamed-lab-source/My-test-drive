// Your saving, backup money and investments, worked out from your data.
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { usePersonalStore, ensurePersonalLoaded, type Item } from '../../store/personalStore';
import { convertToBase } from '../../db/repositories/fx';
import { monthPeriod } from '../../utils/period';
import { formatMoneyWhole } from '../../utils/money';
import {
  allocation,
  averageSpend,
  ESSENTIAL,
  backupStatus,
  holdingValue,
  kindInfo,
  monthTotals,
  moneyLadder,
  riskProfile,
  TARGET_MIX,
  type Bucket,
  type Holding,
  type WealthTx,
} from '../../utils/wealth';

export function useWealth() {
  const f = useFinanceStore(useShallow((s) => ({ transactions: s.transactions, accounts: s.accounts, debts: s.debts, fxRates: s.fxRates, categories: s.categories })));
  const st = useSettingsStore(
    useShallow((s) => ({
      currency: s.currency,
      backupMonths: s.backupMonths,
      backupAccountIds: s.backupAccountIds,
      backupHoldingIds: s.backupHoldingIds,
      backupEssentialsOnly: s.backupEssentialsOnly,
      riskAnswers: s.riskAnswers,
      monthlyInvest: s.monthlyInvest,
      gold24: s.goldPricePerGram,
      monthStartDay: s.monthStartDay,
      monthFromPayday: s.monthFromPayday,
    }))
  );
  const holdings = usePersonalStore((s) => s.holding);
  useEffect(() => ensurePersonalLoaded(), []);

  return useMemo(() => {
    const now = new Date();
    const base = st.currency;
    const toBase = (a: number, c: string) => convertToBase(a, c, base, f.fxRates);
    const fmt = (m: number) => formatMoneyWhole(m, base);
    const catName = new Map(f.categories.map((c) => [c.id, c.name]));
    const current = monthPeriod(now);
    // The last six full money months, oldest first.
    const past = [6, 5, 4, 3, 2, 1].map((k) => monthPeriod(now, -k));
    const since = past[0].start.getTime();
    const txs: WealthTx[] = f.transactions
      .filter((t) => new Date(t.date).getTime() >= since)
      .map((t) => ({ type: t.type, amount: toBase(t.amount, t.currency), date: t.date, note: t.note, category: t.category_id ? catName.get(t.category_id) ?? null : null }));
    const totals = monthTotals(txs, [...past, current]);
    const thisMonth = totals[totals.length - 1];
    const recent3 = past.slice(-3);
    // Without full months yet, this month's pace stands in.
    const elapsed = (now.getTime() - current.start.getTime()) / Math.max(1, current.end.getTime() - current.start.getTime());
    const pace = (essentialsOnly: boolean) => {
      if (elapsed < 0.25) return 0;
      const sum = txs
        .filter((t) => t.type === 'expense' && new Date(t.date) >= current.start && (!essentialsOnly || (t.category && ESSENTIAL.test(t.category))))
        .reduce((x, t) => x + t.amount, 0);
      return Math.round(sum / elapsed);
    };
    const avgSpend = averageSpend(txs, recent3) || pace(false);
    const essentials = averageSpend(txs, recent3, true) || pace(true);
    const monthly = st.backupEssentialsOnly && essentials > 0 ? essentials : avgSpend;
    const pastTotals = totals.slice(0, -1).filter((m) => m.income > 0 || m.expense > 0);
    const avgSaved = pastTotals.length ? Math.round(pastTotals.reduce((s, m) => s + m.saved, 0) / pastTotals.length) : 0;
    const avgIncome = pastTotals.length ? Math.round(pastTotals.reduce((s, m) => s + m.income, 0) / pastTotals.length) : 0;
    const avgRate = avgIncome > 0 ? avgSaved / avgIncome : null;

    const open = f.accounts.filter((a) => !a.is_archived);
    const backupAccounts = st.backupAccountIds
      ? open.filter((a) => st.backupAccountIds!.includes(a.id) && a.type !== 'credit')
      : open.filter((a) => a.type === 'savings');
    const valued = holdings.map((h) => ({ h, value: holdingValue(h, st.gold24, toBase), bucket: kindInfo(h.kind).bucket as Bucket | null }));
    const backupHoldings = valued.filter((v) => st.backupHoldingIds.includes(v.h.id));
    const backupSaved =
      backupAccounts.reduce((s, a) => s + Math.max(0, toBase(a.balance, a.currency)), 0) + backupHoldings.reduce((s, v) => s + v.value, 0);
    const backup = backupStatus(backupSaved, monthly, st.backupMonths);

    // Investments, without what's set aside as backup money.
    const invested = valued.filter((v) => !st.backupHoldingIds.includes(v.h.id));
    const alloc = allocation(invested);
    const investedIn = invested.reduce((s, v) => s + toBase(v.h.invested, v.h.currency), 0);
    const investedNow = invested.reduce((s, v) => s + v.value, 0);
    const profile = st.riskAnswers ? riskProfile(st.riskAnswers) : null;

    const cardDebt = open.filter((a) => a.type === 'credit').reduce((s, a) => s + Math.max(0, toBase(-a.balance, a.currency)), 0);
    const otherDebt = f.debts.filter((d) => d.direction === 'i_owe' && d.status !== 'paid').reduce((s, d) => s + toBase(d.remaining_amount, d.currency), 0);
    const ladder = moneyLadder({
      tracking: f.transactions.length >= 20,
      backupMonths: backup.months,
      targetMonths: st.backupMonths,
      cardDebt,
      otherDebt,
      savingRate: avgRate,
      investing: holdings.length > 0 && st.monthlyInvest > 0,
      fmt,
    });

    return {
      now,
      currency: base,
      fmt,
      toBase,
      txs,
      totals,
      thisMonth,
      past: pastTotals,
      recent3,
      avgSpend,
      essentials,
      avgSaved,
      avgIncome,
      avgRate,
      backup,
      backupAccounts,
      backupHoldings,
      valued,
      invested,
      alloc,
      investedIn,
      investedNow,
      profile,
      target: profile ? TARGET_MIX[profile] : null,
      cardDebt,
      otherDebt,
      ladder,
      holdings: holdings as Item<Holding>[],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, st, holdings]);
}
