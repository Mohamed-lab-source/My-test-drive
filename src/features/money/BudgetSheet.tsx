import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { Card } from '../../ui/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { accentColors } from '../../theme/colors';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../utils/money';
import { budgetAccountIds, budgetCategoryIds, budgetKeywords, PERIOD_WORD, type BudgetStatus } from '../../utils/budgets';
import { monthPeriod, periodLabel } from '../../utils/period';
import { computeBudgetStatuses, budgetName } from './budgetCore';
import { todayKey } from '../../db/client';
import type { Budget, BudgetPeriod } from '../../db/types';

const PERIODS: { id: BudgetPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Dates…' },
];

const ICONS = ['chart.pie.fill', 'cart.fill', 'fork.knife', 'car.fill', 'house.fill', 'bag.fill', 'tshirt.fill', 'gift.fill', 'airplane', 'gamecontroller.fill', 'book.fill', 'graduationcap.fill', 'heart.fill', 'bolt.fill', 'sparkles'];

const ALERTS = [0, 50, 75, 80, 90];

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// One-tap date ranges for a one-off budget (a trip, Ramadan, a project).
const QUICK_RANGES: { id: string; label: string; range: (now: Date) => [Date, Date] }[] = [
  { id: '7', label: 'Next 7 days', range: (now) => [now, addDays(now, 6)] },
  { id: '14', label: '2 weeks', range: (now) => [now, addDays(now, 13)] },
  { id: '30', label: '30 days', range: (now) => [now, addDays(now, 29)] },
  { id: 'month', label: 'Rest of this month', range: (now) => [now, addDays(monthPeriod(now).end, -1)] },
];

const isDateKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00`).getTime());

// Create or edit a budget: any name, amount, period (or dates), which
// categories, accounts and note words count, rollover, warning level, look.
export function BudgetSheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Budget | null }) {
  const { colors, typography, spacing } = useTheme();
  const base = useSettingsStore((s) => s.currency);
  const monthStartDay = useSettingsStore((s) => s.monthStartDay);
  const monthFromPayday = useSettingsStore((s) => s.monthFromPayday);
  const weekStart = useSettingsStore((s) => s.weekStart);
  const { categories, accounts, fxRates, budgets, addBudget, updateBudget } = useFinanceStore();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(base);
  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [catIds, setCatIds] = useState<string[]>([]);
  const [acctIds, setAcctIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [rollover, setRollover] = useState(false);
  const [includeBills, setIncludeBills] = useState(true);
  const [alertPct, setAlertPct] = useState(80);
  const [paused, setPaused] = useState(false);
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState<string>(accentColors[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BudgetStatus | null>(null);

  useEffect(() => {
    if (!visible) return;
    const today = todayKey();
    const week = todayKey(new Date(Date.now() + 6 * 86400000));
    setName(editing?.name ?? '');
    setAmount(editing ? String(fromMinorUnits(editing.monthly_limit)) : '');
    setCurrency(editing?.currency ?? base);
    setPeriod(editing?.period ?? 'monthly');
    setStartDate(editing?.start_date ?? today);
    setEndDate(editing?.end_date ?? week);
    setCatIds(editing ? budgetCategoryIds(editing) : []);
    setAcctIds(editing ? budgetAccountIds(editing) : []);
    setKeywords(editing ? budgetKeywords(editing).join(', ') : '');
    setRollover(!!editing?.rollover);
    setIncludeBills(editing ? editing.include_bills !== 0 : true);
    setAlertPct(editing?.alert_pct ?? 80);
    setPaused(!!editing?.is_paused);
    setIcon(editing?.icon ?? ICONS[0]);
    setColor(editing?.color ?? accentColors[0]);
    setNotes(editing?.notes ?? '');
  }, [visible, editing?.id]);

  const expenseCats = useMemo(() => categories.filter((c) => !c.is_archived && (c.kind === 'expense' || c.kind === 'both')), [categories]);
  const openAccounts = accounts.filter((a) => !a.is_archived);
  const currencies = useMemo(() => Array.from(new Set([base, ...fxRates.map((r) => r.currency), ...openAccounts.map((a) => a.currency)])), [base, fxRates, openAccounts]);

  const custom = period === 'custom';
  const datesOk = !custom || (isDateKey(startDate) && isDateKey(endDate) && endDate >= startDate);
  const canSave = Number(amount) > 0 && datesOk;

  // The budget as it would be saved, for the preview and for saving.
  const draft = useMemo(
    () => ({
      name: name.trim() || null,
      icon,
      color,
      monthly_limit: toMinorUnits(Number(amount) || 0),
      currency,
      period,
      start_date: custom ? startDate : null,
      end_date: custom ? endDate : null,
      category_id: catIds[0] ?? null,
      category_ids: catIds.length ? JSON.stringify(catIds) : null,
      account_ids: acctIds.length ? JSON.stringify(acctIds) : null,
      keywords: keywords.trim() || null,
      rollover: rollover ? 1 : 0,
      include_bills: includeBills ? 1 : 0,
      alert_pct: alertPct,
      is_paused: paused ? 1 : 0,
      notes: notes.trim() || null,
    }),
    [name, icon, color, amount, currency, period, custom, startDate, endDate, catIds, acctIds, keywords, rollover, includeBills, alertPct, paused, notes]
  );

  useEffect(() => {
    if (!visible || !datesOk) return setPreview(null);
    let live = true;
    const b = { ...draft, id: 'preview', created_at: '', is_paused: 0 } as Budget;
    computeBudgetStatuses([b], new Date(), { weekStart }, fxRates)
      .then((s) => live && setPreview(s.preview ?? null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [visible, draft, datesOk, monthStartDay, weekStart, fxRates]);

  const toggle = (list: string[], set: (v: string[]) => void) => (id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing) await updateBudget(editing.id, draft);
      else await addBudget({ ...draft, sort_order: budgets.length });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const label = (t: string) => (
    <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, marginTop: spacing.xs, textTransform: 'uppercase' }]}>{t}</Text>
  );
  const switchRow = (title: string, subtitle: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
      <View style={{ flex: 1, marginRight: spacing.sm }}>
        <Text style={[typography.body, { color: colors.label }]}>{title}</Text>
        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
  const shownName = budgetName({ ...draft, id: '', created_at: '' } as Budget, categories);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>{editing ? 'Edit budget' : 'New budget'}</Text>

        <TextField label="Name" placeholder={shownName} value={name} onChangeText={setName} />
        <TextField label={`Limit ${PERIOD_WORD[period]}`} placeholder="0" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        {currencies.length > 1 ? (
          <View style={{ marginTop: -spacing.xs, marginBottom: spacing.md }}>
            <ChipSelector options={currencies.map((c) => ({ id: c, label: c }))} selectedId={currency} onSelect={setCurrency} />
          </View>
        ) : null}

        {label('Every')}
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector wrap options={PERIODS} selectedId={period} onSelect={(id) => setPeriod(id as BudgetPeriod)} />
        </View>
        {custom ? (
          <View style={{ marginBottom: spacing.sm }}>
            <ChipSelector
              options={QUICK_RANGES.map((r) => ({ id: r.id, label: r.label }))}
              selectedId={null}
              onSelect={(id) => {
                const [from, to] = QUICK_RANGES.find((r) => r.id === id)!.range(new Date());
                setStartDate(todayKey(from));
                setEndDate(todayKey(to));
              }}
            />
          </View>
        ) : null}
        {custom ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <TextField label="From (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} autoCapitalize="none" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="To (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} autoCapitalize="none" />
            </View>
          </View>
        ) : period === 'monthly' && (monthFromPayday || monthStartDay !== 1) ? (
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -spacing.xs, marginBottom: spacing.md }]}>
            {monthFromPayday ? 'Months start when your salary arrives' : `Months start on day ${monthStartDay}`}, as set in Settings.
          </Text>
        ) : null}

        {label('Categories')}
        <ChipSelector
          wrap
          options={[{ id: '__all', label: 'All spending', icon: 'sparkles' }, ...expenseCats.map((c) => ({ id: c.id, label: c.name, icon: c.icon, color: c.color }))]}
          selectedIds={catIds.length ? catIds : ['__all']}
          onSelect={(id) => (id === '__all' ? setCatIds([]) : toggle(catIds, setCatIds)(id))}
        />

        {openAccounts.length > 1 ? (
          <>
            {label('Accounts & cards')}
            <ChipSelector
              wrap
              options={[{ id: '__all', label: 'Any account' }, ...openAccounts.map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color }))]}
              selectedIds={acctIds.length ? acctIds : ['__all']}
              onSelect={(id) => (id === '__all' ? setAcctIds([]) : toggle(acctIds, setAcctIds)(id))}
            />
          </>
        ) : null}

        <View style={{ height: spacing.sm }} />
        <TextField label="Only notes containing (optional)" placeholder="e.g. Talabat, Uber, Starbucks" value={keywords} onChangeText={setKeywords} />

        {switchRow('Count bills', 'Include recurring bills and subscriptions, not just day-to-day spending', includeBills, setIncludeBills)}
        {!custom ? switchRow('Roll over', "Carry what's left (or what you overspent) into the next period", rollover, setRollover) : null}

        {label('Warn me at')}
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector wrap options={ALERTS.map((p) => ({ id: String(p), label: p ? `${p}%` : 'Only when over' }))} selectedId={String(alertPct)} onSelect={(id) => setAlertPct(Number(id))} />
        </View>

        {label('Icon')}
        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelector options={ICONS.map((i) => ({ id: i, label: '', icon: i, color }))} selectedId={icon} onSelect={setIcon} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
          {accentColors.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, marginRight: 10, marginBottom: 8, borderWidth: c === color ? 3 : 0, borderColor: colors.label }}
            />
          ))}
        </View>

        <TextField label="Notes (optional)" placeholder="Why this budget, or what it's for" value={notes} onChangeText={setNotes} multiline />
        {editing ? switchRow('Paused', "Not tracked and no alerts until you turn it back on", paused, setPaused) : null}

        {preview && Number(amount) > 0 ? (
          <Card style={{ marginBottom: spacing.md, backgroundColor: colors.tertiaryFill }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, fontWeight: '600' }]}>
              {preview.state === 'upcoming' ? 'Starts ' : preview.state === 'ended' ? 'Ended · ' : 'Now · '}
              {periodLabel(preview.period)}
            </Text>
            <Text style={[typography.headline, { color: preview.left < 0 ? colors.red : colors.label, marginTop: 2 }]}>
              {formatMoney(preview.spent, currency)} spent of {formatMoney(preview.available, currency)}
            </Text>
            {preview.carried ? (
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                Includes {formatMoney(Math.abs(preview.carried), currency)} {preview.carried > 0 ? 'left over from' : 'overspent in'} the last period
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Button title={editing ? 'Save' : 'Add budget'} onPress={handleSave} disabled={!canSave} loading={saving} />
        {custom && !datesOk ? (
          <Text style={[typography.caption1, { color: colors.red, marginTop: spacing.xs }]}>Enter dates as YYYY-MM-DD, with the end on or after the start.</Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
