import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../../src/ui/Icon';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as financeRepo from '../../../src/db/repositories/finance';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { ActionMenu } from '../../../src/ui/ActionMenu';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { formatMoney } from '../../../src/utils/money';
import { convertToBase } from '../../../src/db/repositories/fx';
import { BudgetSheet } from '../../../src/features/money/BudgetSheet';
import { budgetName } from '../../../src/features/money/budgetCore';
import { useBudgetStatuses } from '../../../src/features/money/budgets';
import { budgetAccountIds, budgetCategoryIds, budgetKeywords, PERIOD_WORD } from '../../../src/utils/budgets';
import { monthPeriod, periodLabel } from '../../../src/utils/period';
import { showUndoDelete } from '../../../src/ui/undo';
import type { Budget } from '../../../src/db/types';

const PERIOD_NAME: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', custom: 'Dates' };

export default function BudgetsScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { budgets, categories, accounts, fxRates, removeBudget, refreshBudgets, setBudget, addBudget, updateBudget } = useFinanceStore(useShallow((s) => ({ budgets: s.budgets, categories: s.categories, accounts: s.accounts, fxRates: s.fxRates, removeBudget: s.removeBudget, refreshBudgets: s.refreshBudgets, setBudget: s.setBudget, addBudget: s.addBudget, updateBudget: s.updateBudget })));
  const currency = useSettingsStore((s) => s.currency);
  const statuses = useBudgetStatuses();
  const [editing, setEditing] = useState<Budget | null>(null);
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<Budget | null>(null);
  const [filter, setFilter] = useState('all');

  // Averages each expense category over the last three money months and
  // proposes that (rounded up to a whole 10) as a monthly budget.
  // Categories already covered by a budget are left alone.
  const suggestBudgets = async () => {
    const start = monthPeriod(new Date(), -3).start.toISOString();
    const end = monthPeriod(new Date()).start.toISOString();
    const txs = (await financeRepo.listTransactionsInRange(start, end)).filter((t) => t.type === 'expense' && t.category_id);
    const totals = new Map<string, number>();
    for (const t of txs) totals.set(t.category_id!, (totals.get(t.category_id!) ?? 0) + t.amount);
    const existing = new Set(budgets.flatMap((b) => budgetCategoryIds(b)));
    const suggestions = Array.from(totals.entries())
      .filter(([id]) => !existing.has(id))
      .map(([id, total]) => ({ id, limit: Math.ceil(total / 3 / 1000) * 1000 }))
      .filter((s) => s.limit > 0);
    if (suggestions.length === 0) {
      Alert.alert('No suggestions', 'Anchor needs some spending in the last three months for categories without a budget yet.');
      return;
    }
    const lines = suggestions.map((s) => `${categories.find((c) => c.id === s.id)?.name ?? 'Category'}: ${formatMoney(s.limit, currency)}`);
    Alert.alert('Suggested budgets', `Based on your 3-month average:\n\n${lines.join('\n')}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add all',
        onPress: async () => {
          for (const s of suggestions) await setBudget(s.id, s.limit, currency);
        },
      },
    ]);
  };

  const handleDelete = async (budget: Budget) => {
    await removeBudget(budget.id);
    showUndoDelete('budgets', budget, 'Budget deleted', refreshBudgets);
  };

  const duplicate = async (b: Budget) => {
    const { id: _id, created_at: _c, ...rest } = b;
    await addBudget({ ...rest, name: `${budgetName(b, categories)} copy`, sort_order: budgets.length });
  };

  // What each budget covers, in a few words.
  const scope = (b: Budget) => {
    const parts: string[] = [PERIOD_NAME[b.period ?? 'monthly']];
    const cats = budgetCategoryIds(b);
    const accts = budgetAccountIds(b);
    const words = budgetKeywords(b);
    if (b.name?.trim() && cats.length) parts.push(cats.map((id) => categories.find((c) => c.id === id)?.name ?? '?').slice(0, 2).join(', ') + (cats.length > 2 ? ` +${cats.length - 2}` : ''));
    else if (!cats.length && !accts.length && !words.length) parts.push('all spending');
    if (accts.length) parts.push(accts.map((id) => accounts.find((a) => a.id === id)?.name ?? '?').slice(0, 2).join(', ') + (accts.length > 2 ? ` +${accts.length - 2}` : ''));
    if (words.length) parts.push(`“${words.slice(0, 2).join('”, “')}”`);
    if (b.include_bills === 0) parts.push('no bills');
    if (b.rollover) parts.push('rolls over');
    return parts.join(' · ');
  };

  const periodsPresent = Array.from(new Set(budgets.map((b) => b.period ?? 'monthly')));
  const shown = useMemo(() => {
    const list = budgets.filter((b) =>
      filter === 'all' ? true : filter === 'paused' ? !!b.is_paused : !b.is_paused && (b.period ?? 'monthly') === filter
    );
    // Paused and finished ones last; otherwise closest to (or over) the limit first.
    const rank = (b: Budget) => (b.is_paused ? 3 : statuses[b.id]?.state === 'ended' ? 2 : statuses[b.id]?.state === 'upcoming' ? 1 : 0);
    return list.sort((a, b) => rank(a) - rank(b) || (statuses[b.id]?.progress ?? 0) - (statuses[a.id]?.progress ?? 0));
  }, [budgets, statuses, filter]);

  // The monthly ones add up to a picture of this month.
  const summary = useMemo(() => {
    const monthly = budgets.filter((b) => !b.is_paused && (b.period ?? 'monthly') === 'monthly' && statuses[b.id]);
    const toBase = (n: number, c: string) => convertToBase(n, c, currency, fxRates);
    const limit = monthly.reduce((s, b) => s + toBase(statuses[b.id].available, b.currency), 0);
    const spent = monthly.reduce((s, b) => s + toBase(statuses[b.id].spent, b.currency), 0);
    const daysLeft = monthly.length ? statuses[monthly[0].id].daysLeft : 1;
    const over = Object.values(statuses).filter((s) => s.state === 'active' && s.pace === 'over').length;
    const ahead = Object.values(statuses).filter((s) => s.state === 'active' && s.pace === 'ahead').length;
    return { count: monthly.length, limit, spent, daysLeft, over, ahead };
  }, [budgets, statuses, currency, fxRates]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Budgets" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Pressable onPress={suggestBudgets} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginBottom: spacing.sm }}>
          <Icon name="sparkles" size={16} color={colors.blue} />
          <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>Suggest from my spending</Text>
        </Pressable>
        {budgets.length === 0 ? (
          <EmptyState
            icon="chart.pie.fill"
            title="No budgets yet"
            message="Make one for anything: a category or several, one card, a daily coffee limit, a trip between two dates — monthly, weekly, daily or yearly."
          />
        ) : (
          <>
            {summary.count ? (
              <Card style={{ marginBottom: spacing.md }}>
                <Text style={[typography.footnote, { color: colors.secondaryLabel, fontWeight: '600', textTransform: 'uppercase' }]}>
                  Monthly budgets · {periodLabel(monthPeriod())}
                </Text>
                <Text style={[typography.title2, { color: summary.spent > summary.limit ? colors.red : colors.label, marginTop: 2 }]}>
                  {formatMoney(summary.spent, currency)} <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>of {formatMoney(summary.limit, currency)}</Text>
                </Text>
                <View style={{ marginTop: spacing.sm }}>
                  <ProgressBar progress={summary.limit ? summary.spent / summary.limit : 0} color={summary.spent > summary.limit ? colors.red : colors.green} />
                </View>
                <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                  {summary.limit > summary.spent
                    ? `${formatMoney(summary.limit - summary.spent, currency)} left · ${formatMoney(Math.floor((summary.limit - summary.spent) / Math.max(1, summary.daysLeft)), currency)} a day`
                    : `${formatMoney(summary.spent - summary.limit, currency)} over`}
                  {summary.over ? ` · ${summary.over} over budget` : ''}
                  {summary.ahead ? ` · ${summary.ahead} ahead of pace` : ''}
                </Text>
              </Card>
            ) : null}

            {periodsPresent.length > 1 || budgets.some((b) => b.is_paused) ? (
              <View style={{ marginBottom: spacing.md }}>
                <ChipSelector
                  options={[
                    { id: 'all', label: `All ${budgets.length}` },
                    ...periodsPresent.map((p) => ({ id: p, label: PERIOD_NAME[p] })),
                    ...(budgets.some((b) => b.is_paused) ? [{ id: 'paused', label: 'Paused' }] : []),
                  ]}
                  selectedId={filter}
                  onSelect={setFilter}
                />
              </View>
            ) : null}

            {shown.map((budget) => {
              const st = statuses[budget.id];
              const cats = budgetCategoryIds(budget);
              const firstCat = categories.find((c) => c.id === cats[0]);
              const tint = budget.color ?? firstCat?.color ?? colors.blue;
              const name = budgetName(budget, categories);
              const word = PERIOD_WORD[budget.period ?? 'monthly'];
              const paused = !!budget.is_paused;
              const badge = paused
                ? { text: 'Paused', color: colors.secondaryLabel }
                : !st
                  ? null
                  : st.state === 'upcoming'
                    ? { text: 'Upcoming', color: colors.blue }
                    : st.state === 'ended'
                      ? { text: st.spent > st.available ? 'Ended over' : 'Ended', color: st.spent > st.available ? colors.red : colors.secondaryLabel }
                      : st.pace === 'over'
                        ? { text: 'Over', color: colors.red }
                        : st.pace === 'ahead'
                          ? { text: budget.period === 'daily' ? 'Nearly used' : 'Ahead of pace', color: colors.orange }
                          : st.pace === 'under'
                            ? { text: 'Well under', color: colors.green }
                            : { text: 'On track', color: colors.green };
              return (
                <SwipeableRow
                  key={budget.id}
                  actions={[
                    { label: paused ? 'Resume' : 'Pause', color: colors.orange, icon: paused ? 'play.fill' : 'pause.fill', onPress: () => updateBudget(budget.id, { is_paused: paused ? 0 : 1 }) },
                    { label: 'Delete', color: colors.red, icon: 'trash.fill', onPress: () => handleDelete(budget) },
                  ]}
                >
                  <Pressable onPress={() => setEditing(budget)} onLongPress={() => setMenuFor(budget)} delayLongPress={350} accessibilityRole="button" accessibilityHint="Edit this budget">
                    <Card style={{ marginBottom: spacing.sm, opacity: paused ? 0.6 : 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconCircle name={budget.icon ?? firstCat?.icon ?? 'chart.pie.fill'} color={tint} />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                            {scope(budget)}
                          </Text>
                        </View>
                        {badge ? <Text style={[typography.caption1, { color: badge.color, fontWeight: '700' }]}>{badge.text}</Text> : null}
                      </View>
                      {st && !paused ? (
                        <>
                          <Text style={[typography.footnote, { color: st.spent > st.available ? colors.red : colors.label, marginTop: spacing.sm }]}>
                            {formatMoney(st.spent, budget.currency)} of {formatMoney(st.available, budget.currency)} {word}
                            {budget.period === 'custom' || budget.period === 'monthly' ? (
                              <Text style={{ color: colors.secondaryLabel }}> · {periodLabel(st.period)}</Text>
                            ) : null}
                          </Text>
                          <View style={{ marginTop: 6 }}>
                            <ProgressBar progress={Math.min(1, st.progress)} color={st.spent > st.available ? colors.red : tint} />
                            {st.state === 'active' ? (
                              // Where spending "should" be by now if spread evenly.
                              <View
                                style={{ position: 'absolute', left: `${Math.min(100, st.elapsed * 100)}%`, top: -3, bottom: -3, width: 2, backgroundColor: colors.label, opacity: 0.35 }}
                              />
                            ) : null}
                          </View>
                          {st.state === 'active' && st.left > 0 && budget.period !== 'daily' ? (
                            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                              {formatMoney(st.left, budget.currency)} left · {formatMoney(st.perDayLeft, budget.currency)} a day for {st.daysLeft} day{st.daysLeft === 1 ? '' : 's'}
                            </Text>
                          ) : st.state === 'active' && st.left > 0 ? (
                            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>{formatMoney(st.left, budget.currency)} left today</Text>
                          ) : st.state === 'active' ? (
                            <Text style={[typography.caption1, { color: colors.red, marginTop: 4 }]}>{formatMoney(-st.left, budget.currency)} over</Text>
                          ) : null}
                          {st.state === 'active' && budget.period !== 'daily' ? (
                            <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]}>
                              On pace for {formatMoney(st.projected, budget.currency)}
                              {budget.period !== 'custom' && st.previousSpent ? ` · last time ${formatMoney(st.previousSpent, budget.currency)}` : ''}
                              {st.carried ? ` · ${st.carried > 0 ? '+' : '−'}${formatMoney(Math.abs(st.carried), budget.currency)} rolled over` : ''}
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                      {budget.notes ? (
                        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4, fontStyle: 'italic' }]} numberOfLines={2}>
                          {budget.notes}
                        </Text>
                      ) : null}
                    </Card>
                  </Pressable>
                </SwipeableRow>
              );
            })}
            <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center', marginTop: spacing.sm }]}>
              Tap a budget to change anything about it · hold for more · swipe to pause or delete
            </Text>
          </>
        )}
      </ScrollView>
      <FAB onPress={() => setAdding(true)} />
      <BudgetSheet visible={adding || !!editing} editing={editing} onClose={() => (setAdding(false), setEditing(null))} />
      <ActionMenu
        visible={!!menuFor}
        title={menuFor ? budgetName(menuFor, categories) : undefined}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: 'Edit', icon: 'pencil', onPress: () => setEditing(menuFor) },
                {
                  label: 'See spending',
                  icon: 'list.bullet',
                  onPress: () => {
                    const cats = budgetCategoryIds(menuFor);
                    const accts = budgetAccountIds(menuFor);
                    const words = budgetKeywords(menuFor);
                    const params: Record<string, string> = { period: (menuFor.period ?? 'monthly') === 'weekly' ? 'week' : (menuFor.period ?? 'monthly') === 'yearly' ? 'year' : 'month' };
                    if (cats.length === 1) params.category = cats[0];
                    if (accts.length === 1) params.account = accts[0];
                    if (words.length) params.q = words[0];
                    router.push({ pathname: '/money/transactions', params });
                  },
                },
                { label: 'Duplicate', icon: 'doc.on.doc', onPress: () => duplicate(menuFor) },
                {
                  label: menuFor.is_paused ? 'Resume' : 'Pause',
                  icon: menuFor.is_paused ? 'play.fill' : 'pause.fill',
                  onPress: () => updateBudget(menuFor.id, { is_paused: menuFor.is_paused ? 0 : 1 }),
                },
                { label: 'Delete', icon: 'trash', destructive: true, section: true, onPress: () => handleDelete(menuFor) },
              ]
            : []
        }
      />
    </View>
  );
}
